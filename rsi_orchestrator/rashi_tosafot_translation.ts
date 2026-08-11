import * as fs from "fs";
import {Amud, ApiComment} from "../apiTypes";
import {Book, books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {aiEditsForPage, Edit} from "../precomputed/ai_edits";
import {recordContextUsage} from "../precomputed/rsi_state/context_usage_log";
import {
  listPagesWithGenerationRecords,
  readGenerationRecord,
  readGenerationRecordsForPage,
  upsertGenerationRecord,
} from "../precomputed/rsi_state/generation_record";
import {buildPageSkeleton, formatPageSkeleton} from "../precomputed/rsi_state/page_skeleton";
import {
  checkTextStaleness,
  DEFAULT_STALENESS_THRESHOLDS,
  StalenessStatus,
} from "../precomputed/rsi_state/staleness";
import {toFlatArray} from "../sefariaTextType";
import {extractRequestedRefs} from "./context_fetch";
import {HeadlessClaudeError, runHeadlessClaude} from "./headless_claude";

/**
 * Translates and punctuates Rashi/Tosafot comments — the first task type on the new agentic
 * pipeline, replacing precomputed/sugya_prompt_client.ts (Gemini-based, retired but left in place
 * unused). The generation prompt inlines a compact page skeleton (page_skeleton.ts) plus 1-2
 * worked examples of past accepted output, rather than pointing Claude at the page's full raw
 * cached JSON — RSIAgentDesignRetrospective.md documented that "goal + raw filesystem access"
 * led to real, expensive wandering (a single call reading unrelated books looking for calibration
 * examples). `context_fetch_cli.ts` is the only tool available beyond the initial prompt, so any
 * further context Claude decides it needs is ref-addressed and size-capped rather than open-ended
 * file access.
 */

export const TASK_TYPE = "rashi_tosafot_translation";
const PROMPT_VERSION = "v2";
// Hardcoded for now — Phase 4's routing tuner is meant to replace this with a per-task-type value
// chosen from logged outcomes, not this constant. See "Model routing" in
// RecursiveSelfImprovingAgentPlan.md.
const MODEL = "claude-sonnet-5";
// The only tool this task type's headless calls may use — see the module doc above. Scoped to
// this exact command so it can't fall back to arbitrary Bash use.
const CONTEXT_FETCH_ALLOWED_TOOLS = ["Bash(npx ts-node rsi_orchestrator/context_fetch_cli.ts *)"];
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

export interface CritiqueOutcome {
  verdict: CritiqueVerdict;
  costUsd: number | undefined;
  // Refs this call fetched via context_fetch_cli (see context_fetch.ts's extractRequestedRefs) —
  // unioned with the accepted generate call's own contextRefsUsed to become the generation
  // record's `dependsOn`, so cascading staleness invalidation covers everything the accepted
  // edit's validity actually rested on, not just its primary source ref.
  contextRefsUsed: string[];
}

/** The canonical model ID is threaded through so the generation record can capture what actually
 * produced the accepted edit, for Phase 4's model-routing learning. */
export interface GeneratedEdit {
  edit: Edit;
  model: string | undefined;
  // Cost of just this one call — generateWithSelfCritique sums this across every call (including
  // rejected attempts) before handing it to the caller, so the value callers actually see is the
  // full cost of producing the accepted edit, not just the last call.
  costUsd: number | undefined;
  contextRefsUsed: string[];
}

export interface GenerationDeps {
  generate: (candidate: TranslationCandidate, priorFeedback?: string) => Promise<GeneratedEdit>;
  critique: (candidate: TranslationCandidate, edit: Edit) => Promise<CritiqueOutcome>;
}

function sumCost(...costs: (number | undefined)[]): number | undefined {
  if (costs.every(c => c === undefined)) return undefined;
  return costs.reduce((total: number, c) => total + (c ?? 0), 0);
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
  let outcome = await deps.critique(candidate, generated.edit);
  let totalCost = sumCost(generated.costUsd, outcome.costUsd);
  if (!outcome.verdict.valid) {
    generated = await deps.generate(candidate, outcome.verdict.reason);
    outcome = await deps.critique(candidate, generated.edit);
    totalCost = sumCost(totalCost, generated.costUsd, outcome.costUsd);
  }
  if (!outcome.verdict.valid) {
    console.error(`Giving up on ${candidate.ref}: ${outcome.verdict.reason}`);
    return undefined;
  }
  // Only the final, accepted generate+critique pair's context counts — a rejected first
  // attempt's fetches didn't contribute to what actually shipped.
  const contextRefsUsed = Array.from(
    new Set([...generated.contextRefsUsed, ...outcome.contextRefsUsed]));
  return {...generated, costUsd: totalCost, contextRefsUsed};
}

export interface TranslationDeps {
  listCandidates: () => TranslationCandidate[];
  isFresh: (candidate: TranslationCandidate) => boolean;
  // May reject — translateRashiTosafotComments stops the whole run on a HeadlessClaudeError with
  // isRateLimited, and skips just this candidate on any other error.
  generate: (candidate: TranslationCandidate) => Promise<GeneratedEdit | undefined>;
  writeEdit: (candidate: TranslationCandidate, edit: Edit) => void;
  recordGeneration: (candidate: TranslationCandidate, generated: GeneratedEdit) => void;
}

export async function translateRashiTosafotComments(deps: TranslationDeps): Promise<void> {
  for (const candidate of deps.listCandidates()) {
    if (deps.isFresh(candidate)) continue;
    let generated;
    try {
      // Deliberately sequential — see the same rationale in triage_suggestions.ts.
      // eslint-disable-next-line no-await-in-loop
      generated = await deps.generate(candidate);
    } catch (e) {
      if (e instanceof HeadlessClaudeError && e.isRateLimited) {
        // Every remaining candidate would fail against the same wall — stop the run rather than
        // burn through it logging the identical failure. Subscription usage limits are the
        // expected budget signal under self-hosted billing; see RecursiveSelfImprovingAgentPlan.md.
        console.error(`Stopping: hit the usage limit (${e.message})`);
        return;
      }
      console.error(`Skipping ${candidate.ref}: ${e}`);
      continue;
    }
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
  return result.status === StalenessStatus.Fresh;
}

interface WorkedExample {
  hebrewSource: string;
  hebrew?: string;
  english?: string;
}

const MAX_WORKED_EXAMPLES = 2;

// Used only until real accepted generations exist to draw examples from — see findWorkedExamples.
const FALLBACK_WORKED_EXAMPLE: Record<Commentator, WorkedExample> = {
  Rashi: {
    hebrewSource: "ואם תמצי לומר דבר זה קשה",
    hebrew: "<strong class=\"dibur-hamatchil\">ואם תמצי לומר</strong> - דבר זה קשה:",
    english: "<strong class=\"dibur-hamatchil\">And if you should say:</strong> "
      + "This matter is difficult.",
  },
  Tosafot: {
    hebrewSource: "וכן משמע בכל דוכתא",
    hebrew: "<strong class=\"dibur-hamatchil\">וכן משמע</strong> - בכל דוכתא:",
    english: "<strong class=\"dibur-hamatchil\">And so it implies:</strong> in every place.",
  },
};

/**
 * Pulls worked examples of past *accepted* output for the same commentator from real generation
 * records + their corresponding ai_additions, to inline directly in the prompt — addressing
 * RSIAgentDesignRetrospective.md's working hypothesis that Claude went hunting across the corpus
 * for calibration examples specifically because none were given up front.
 */
function findWorkedExamples(commentator: Commentator, excludeRef: string): WorkedExample[] {
  const examples: WorkedExample[] = [];
  for (const page of listPagesWithGenerationRecords(TASK_TYPE)) {
    const edits = aiEditsForPage(page);
    if (!edits) continue;
    const records = readGenerationRecordsForPage(TASK_TYPE, page);
    for (const [ref, record] of Object.entries(records)) {
      if (ref === excludeRef || !ref.startsWith(`${commentator} on `)) continue;
      const edit = edits[ref];
      if (!edit) continue;
      examples.push({hebrewSource: record.sourceText, hebrew: edit.hebrew, english: edit.english});
      if (examples.length >= MAX_WORKED_EXAMPLES) return examples;
    }
  }
  return examples;
}

function formatWorkedExamples(examples: WorkedExample[]): string {
  return examples.map((example, i) => [
    `Example ${i + 1}:`,
    `  Source Hebrew: ${example.hebrewSource}`,
    example.hebrew ? `  Punctuated Hebrew: ${example.hebrew}` : undefined,
    example.english ? `  English translation: ${example.english}` : undefined,
  ].filter((line): line is string => line !== undefined).join("\n")).join("\n\n");
}

function generationPrompt(candidate: TranslationCandidate, priorFeedback?: string): string {
  const book = books.byCanonicalName[candidate.book] as Book | undefined;
  const skeleton = book ? buildPageSkeleton(book, candidate.section) : undefined;
  const examples = findWorkedExamples(candidate.commentator, candidate.ref);
  const workedExamples = examples.length > 0
    ? examples : [FALLBACK_WORKED_EXAMPLE[candidate.commentator]];

  return [
    "You're translating and punctuating a single commentary comment on the Talmud, for",
    "talmud.page (an interactive study tool).",
    "",
    `Comment ref: ${candidate.ref}`,
    `Commentator: ${candidate.commentator}`,
    `Current Hebrew text: ${candidate.hebrewSource}`,
    "",
    "Worked example(s) of the expected output — punctuation style, and how literal vs. free the",
    "English translation should be:",
    "",
    formatWorkedExamples(workedExamples),
    "",
    "This page's segments and commentary, for orientation (not full text):",
    skeleton ? formatPageSkeleton(skeleton) : "(page not cached)",
    "",
    "If you need the actual text of something beyond what's given above — a neighboring segment,",
    "another commentary on this segment, or a prior sugya — the only tool available to you is",
    "context_fetch_cli:",
    "  npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs '[\"<ref>\", ...]'",
    "  npx ts-node rsi_orchestrator/context_fetch_cli.ts get-neighbors \"<segment ref>\" "
      + "[--before N] [--after N]",
    "  npx ts-node rsi_orchestrator/context_fetch_cli.ts get-prior-sugyot \"<any ref on this "
      + "page>\" [--count N]",
    "Use your own judgment about whether you need any of this — most comments don't need extra",
    "context beyond what's already above. Each call is capped in size, so ask for specific refs",
    "rather than trying to pull in everything at once.",
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
  const result = await runHeadlessClaude(
    generationPrompt(candidate, priorFeedback),
    {model: MODEL, allowedTools: CONTEXT_FETCH_ALLOWED_TOOLS});
  recordContextUsage({
    taskType: TASK_TYPE,
    ref: candidate.ref,
    callKind: "generate",
    toolUses: result.toolUses,
    costUsd: result.costUsd,
  });
  return {
    edit: parseJsonResponse<Edit>(result.text),
    model: result.model,
    costUsd: result.costUsd,
    contextRefsUsed: extractRequestedRefs(result.toolUses),
  };
}

async function critiqueViaClaude(
  candidate: TranslationCandidate, edit: Edit,
): Promise<CritiqueOutcome> {
  const result = await runHeadlessClaude(
    critiquePrompt(candidate, edit), {model: MODEL, allowedTools: CONTEXT_FETCH_ALLOWED_TOOLS});
  recordContextUsage({
    taskType: TASK_TYPE,
    ref: candidate.ref,
    callKind: "critique",
    toolUses: result.toolUses,
    costUsd: result.costUsd,
  });
  return {
    verdict: parseJsonResponse<CritiqueVerdict>(result.text),
    costUsd: result.costUsd,
    contextRefsUsed: extractRequestedRefs(result.toolUses),
  };
}

export async function generateAndRecord(
  candidate: TranslationCandidate,
): Promise<GeneratedEdit | undefined> {
  return generateWithSelfCritique(candidate, {
    generate: generateViaClaude,
    critique: critiqueViaClaude,
  });
}

export function recordGenerationForCandidate(
  candidate: TranslationCandidate, generated: GeneratedEdit,
): void {
  upsertGenerationRecord(TASK_TYPE, candidate.page, candidate.ref, {
    sourceRefs: [candidate.ref],
    sourceText: candidate.hebrewSource,
    model: generated.model ?? "unknown",
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    // Auto-populated from what context_fetch_cli actually served during the accepted generate +
    // critique calls (see generateWithSelfCritique) — not self-reported by the model. This is
    // what lets a Tier 3 staleness hit on a fetched ref cascade to this artifact too.
    dependsOn: generated.contextRefsUsed,
    costUsd: generated.costUsd,
  });
}
