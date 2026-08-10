import * as fs from "fs";
import {Amud, ApiComment} from "../apiTypes";
import {Book, books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {Edit, writeAiEdit} from "../precomputed/ai_edits";
import {readGenerationRecord, upsertGenerationRecord} from "../precomputed/rsi_state/generation_record";
import {checkTextStaleness, DEFAULT_STALENESS_THRESHOLDS} from "../precomputed/rsi_state/staleness";
import {toFlatArray} from "../sefariaTextType";
import {runHeadlessClaude} from "./headless_claude";

/**
 * Translates and punctuates Rashi/Tosafot comments — the first task type on the new agentic
 * pipeline, replacing precomputed/sugya_prompt_client.ts (Gemini-based, retired but left in place
 * unused). Unlike that pipeline, this one does not pre-assemble context (prior sugyot,
 * commentaries) itself — it points Claude at where that data lives in the repo and lets it decide
 * what to read, per RecursiveSelfImprovingAgentPlan.md's "goal and tools, not a scripted
 * context-assembly function."
 */

export const TASK_TYPE = "rashi_tosafot_translation";
const PROMPT_VERSION = "v1";
const COMMENTATORS = ["Rashi", "Tosafot"] as const;
type Commentator = typeof COMMENTATORS[number];

export interface TranslationCandidate {
  page: string; // e.g. "Zevachim 2a" — matches ai_additions/segmentsPerPage.json's key format
  book: string; // canonical book name, e.g. "Zevachim"
  section: string; // e.g. "2a" — the part of `page` after the book name
  ref: string; // the comment's own ref, e.g. "Rashi on Zevachim 2a:1:1"
  commentator: Commentator;
  hebrewSource: string;
}

export interface CritiqueVerdict {
  valid: boolean;
  reason: string;
}

/** The canonical model ID is threaded through so the generation record can capture what actually
 * produced the accepted edit, for Phase 4's model-routing learning. */
export interface GeneratedEdit {
  edit: Edit;
  model: string | undefined;
}

export interface GenerationDeps {
  generate: (candidate: TranslationCandidate, priorFeedback?: string) => Promise<GeneratedEdit>;
  critique: (candidate: TranslationCandidate, edit: Edit) => Promise<CritiqueVerdict>;
}

/**
 * Generate once, critique it, and — if the critique finds a problem — retry generation once with
 * that feedback before giving up. Bounded at two generation attempts so a persistently bad
 * candidate doesn't loop forever.
 */
export async function generateWithSelfCritique(
  candidate: TranslationCandidate, deps: GenerationDeps,
): Promise<GeneratedEdit | undefined> {
  let generated = await deps.generate(candidate);
  let verdict = await deps.critique(candidate, generated.edit);
  if (!verdict.valid) {
    generated = await deps.generate(candidate, verdict.reason);
    verdict = await deps.critique(candidate, generated.edit);
  }
  if (!verdict.valid) {
    console.error(`Giving up on ${candidate.ref}: ${verdict.reason}`);
    return undefined;
  }
  return generated;
}

export interface TranslationDeps {
  listCandidates: () => TranslationCandidate[];
  isFresh: (candidate: TranslationCandidate) => boolean;
  generate: (candidate: TranslationCandidate) => Promise<GeneratedEdit | undefined>;
  writeEdit: (candidate: TranslationCandidate, edit: Edit) => void;
  recordGeneration: (candidate: TranslationCandidate, generated: GeneratedEdit) => void;
}

export async function translateRashiTosafotComments(deps: TranslationDeps): Promise<void> {
  for (const candidate of deps.listCandidates()) {
    if (deps.isFresh(candidate)) continue;
    // Deliberately sequential — see the same rationale in triage_suggestions.ts.
    // eslint-disable-next-line no-await-in-loop
    const generated = await deps.generate(candidate);
    if (!generated) continue;
    deps.writeEdit(candidate, generated.edit);
    deps.recordGeneration(candidate, generated);
  }
}

function hebrewText(comment: ApiComment): string {
  return toFlatArray(comment.he).join(" ");
}

export function listCandidatesForBook(book: Book): TranslationCandidate[] {
  const candidates: TranslationCandidate[] = [];
  for (const section of Array.from(book.sections)) {
    const filePath = cachedOutputFilePath(book, section);
    if (!fs.existsSync(filePath)) continue;
    const amud = JSON.parse(readUtf8(filePath)) as Amud;
    const page = `${book.canonicalName} ${section}`;
    for (const segment of amud.sections) {
      for (const commentator of COMMENTATORS) {
        const comments = segment.commentary?.[commentator]?.comments ?? [];
        for (const comment of comments) {
          const hebrewSource = hebrewText(comment);
          if (!hebrewSource.trim()) continue;
          candidates.push({
            page, book: book.canonicalName, section, ref: comment.ref, commentator, hebrewSource,
          });
        }
      }
    }
  }
  return candidates;
}

export function isFreshTranslation(candidate: TranslationCandidate): boolean {
  const record = readGenerationRecord(TASK_TYPE, candidate.page, candidate.ref);
  if (!record) return false;
  const result = checkTextStaleness(
    record.sourceText, candidate.hebrewSource, DEFAULT_STALENESS_THRESHOLDS);
  return result.status === "fresh";
}

function generationPrompt(candidate: TranslationCandidate, priorFeedback?: string): string {
  const cachedFile = `cached_outputs/api_request_handler/${candidate.book}.${candidate.section}.json`;
  return [
    "You're translating and punctuating a single commentary comment on the Talmud, for",
    "talmud.page (an interactive study tool).",
    "",
    `Comment ref: ${candidate.ref}`,
    `Commentator: ${candidate.commentator}`,
    `Current Hebrew text: ${candidate.hebrewSource}`,
    "",
    `This page's full cached data (segments, existing commentary/translations) is at:`,
    `  ${cachedFile}`,
    `Sugya boundaries for this book are at: precomputed/sugyot/${candidate.book}.json`,
    "",
    "If it would help you translate accurately, read the surrounding segments, other",
    "commentaries on this segment, or prior sugyot on this page — use your own judgment about",
    "how much context you actually need. Don't assume you need all of it.",
    "",
    "Tasks:",
    "1. Add punctuation to the Hebrew comment if it doesn't already have it (Rashi/Tosafot",
    "   style: a hyphen separates the dibbur hamatchil from the comment body, and the comment",
    "   ends with a colon, not a period). Expand abbreviations only if you're confident what",
    "   they stand for. Don't change the source text otherwise. Preserve existing HTML tags",
    "   around the same words. Omit the Hebrew field entirely if it would be identical to the",
    "   source.",
    "2. Write an accurate, readable English translation.",
    "3. If the existing translation is in French, German, or Spanish rather than English,",
    "   translate that into English instead of writing a fresh translation.",
    "",
    priorFeedback
      ? `Your previous attempt was rejected for this reason — fix it: ${priorFeedback}`
      : "",
    "",
    'Respond with ONLY a JSON object matching {"hebrew"?: string, "english"?: string} — include',
    "a key only if you're proposing a change to it. No other text before or after the JSON.",
  ].filter(line => line !== "").join("\n");
}

function critiquePrompt(candidate: TranslationCandidate, edit: Edit): string {
  return [
    "You proposed this edit to a Talmud commentary comment. Check it before it ships.",
    "",
    `Original Hebrew: ${candidate.hebrewSource}`,
    `Proposed Hebrew: ${edit.hebrew ?? "(unchanged)"}`,
    `Proposed English: ${edit.english ?? "(none)"}`,
    "",
    "Does the proposed Hebrew preserve the exact wording (only punctuation/HTML changed, no",
    "words added, removed, or changed)? Is the English translation accurate to the Hebrew?",
    "",
    'Respond with ONLY a JSON object: {"valid": boolean, "reason": string}. No other text.',
  ].join("\n");
}

export function parseJsonResponse<T>(text: string): T {
  // Defensive against an occasional markdown code fence around the JSON.
  const stripped = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(stripped) as T;
}

async function generateViaClaude(
  candidate: TranslationCandidate, priorFeedback?: string,
): Promise<GeneratedEdit> {
  const result = await runHeadlessClaude(generationPrompt(candidate, priorFeedback));
  return {edit: parseJsonResponse<Edit>(result.text), model: result.model};
}

async function critiqueViaClaude(
  candidate: TranslationCandidate, edit: Edit,
): Promise<CritiqueVerdict> {
  const result = await runHeadlessClaude(critiquePrompt(candidate, edit));
  return parseJsonResponse<CritiqueVerdict>(result.text);
}

async function generateAndRecord(
  candidate: TranslationCandidate,
): Promise<GeneratedEdit | undefined> {
  return generateWithSelfCritique(candidate, {
    generate: generateViaClaude,
    critique: critiqueViaClaude,
  });
}

function recordGenerationForCandidate(
  candidate: TranslationCandidate, generated: GeneratedEdit,
): void {
  upsertGenerationRecord(TASK_TYPE, candidate.page, candidate.ref, {
    sourceRefs: [candidate.ref],
    sourceText: candidate.hebrewSource,
    model: generated.model ?? "unknown",
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    dependsOn: [],
  });
}

async function main(): Promise<void> {
  const bookName = process.argv[2];
  if (!bookName || !books.byCanonicalName[bookName]) {
    console.error("Usage: ts-node rashi_tosafot_translation.ts <CanonicalBookName> [limit]");
    process.exitCode = 1;
    return;
  }
  const book = books.byCanonicalName[bookName];
  const limit = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
  await translateRashiTosafotComments({
    listCandidates: () => {
      const candidates = listCandidatesForBook(book);
      return limit ? candidates.slice(0, limit) : candidates;
    },
    isFresh: isFreshTranslation,
    generate: generateAndRecord,
    writeEdit: (candidate, edit) => writeAiEdit(candidate.page, candidate.ref, edit),
    recordGeneration: recordGenerationForCandidate,
  });
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exitCode = 1;
  });
}
