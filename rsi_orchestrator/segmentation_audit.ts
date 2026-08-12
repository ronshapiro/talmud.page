import * as fs from "fs";
import {Amud} from "../apiTypes";
import {Book, books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {getTaskModelConfig} from "../precomputed/rsi_state/model_routing";
import {buildPageSkeleton, formatPageSkeleton} from "../precomputed/rsi_state/page_skeleton";
import {recordContextUsage} from "../precomputed/rsi_state/context_usage_log";
import {
  readGenerationRecord,
  upsertGenerationRecord,
} from "../precomputed/rsi_state/generation_record";
import {checkTextStaleness, DEFAULT_STALENESS_THRESHOLDS, StalenessStatus} from "../precomputed/rsi_state/staleness";
import {writeJson} from "../util/json_files";
import {extractRequestedRefs} from "./context_fetch";
import {COMMENTATORS} from "./rashi_tosafot_translation";
import {HeadlessClaudeError, runHeadlessClaude} from "./headless_claude";

/**
 * Detects poorly-split Sefaria segments/comments and suggests better boundaries — the "a Rashi
 * comment that's really two comments" case from RSIAgentRedesignPlan.md. Deliberately an *audit*,
 * not a mutation: it reports findings for human review, it never changes segment boundaries
 * itself (that would require deeper changes to the Sefaria-derived data pipeline than this task
 * type's scope). No self-critique pass either — unlike translation, this task type's output is
 * never auto-applied, so the human reviewer is the judgment gate, not a second model call. A
 * cheap local check (not a model call) drops any suggestion referencing a ref that doesn't
 * actually exist on the page, as a guard against a hallucinated ref rather than a real finding.
 */

export const TASK_TYPE = "segmentation_audit";
const PROMPT_VERSION = "v1";
const CONTEXT_FETCH_ALLOWED_TOOLS = ["Bash(npx ts-node rsi_orchestrator/context_fetch_cli.ts *)"];

export interface SegmentationAuditCandidate {
  page: string; // e.g. "Zevachim 2a"
  book: string; // canonical book name, e.g. "Zevachim"
  section: string; // e.g. "2a"
  // Ordered list of every segment + Rashi/Tosafot comment ref on the page, joined — changes if
  // and only if boundaries change (added/removed/reordered refs), not on unrelated text edits
  // elsewhere on the page. This is the staleness signal for this task type, deliberately
  // different from translation's full-text fingerprint: a punctuation fix shouldn't invalidate a
  // boundary suggestion, but a boundary change always should.
  boundaryFingerprint: string;
}

function pageRefs(amud: Amud): string[] {
  const refs: string[] = [];
  for (const segment of amud.sections) {
    refs.push(segment.ref);
    for (const commentator of COMMENTATORS) {
      for (const comment of segment.commentary?.[commentator]?.comments ?? []) {
        refs.push(comment.ref);
      }
    }
  }
  return refs;
}

function loadAmud(book: Book, section: string): Amud | undefined {
  const filePath = cachedOutputFilePath(book, section);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(readUtf8(filePath)) as Amud;
}

export function listCandidatesForBook(book: Book): SegmentationAuditCandidate[] {
  const candidates: SegmentationAuditCandidate[] = [];
  for (const section of Array.from(book.sections)) {
    const amud = loadAmud(book, section);
    if (!amud) continue;
    candidates.push({
      page: `${book.canonicalName} ${section}`,
      book: book.canonicalName,
      section,
      boundaryFingerprint: pageRefs(amud).join("|"),
    });
  }
  return candidates;
}

export function isFreshAudit(candidate: SegmentationAuditCandidate): boolean {
  const record = readGenerationRecord(TASK_TYPE, candidate.page, candidate.page);
  if (!record) return false;
  const result = checkTextStaleness(
    record.sourceText, candidate.boundaryFingerprint, DEFAULT_STALENESS_THRESHOLDS);
  return result.status === StalenessStatus.Fresh;
}

export interface SegmentationSuggestion {
  refs: string[]; // one ref for "should be split", two+ for "should be merged"
  issue: string;
  suggestion: string;
}

export interface AuditResult {
  suggestions: SegmentationSuggestion[];
}

export interface GeneratedAudit {
  result: AuditResult;
  model: string | undefined;
  costUsd: number | undefined;
  contextRefsUsed: string[];
}

function generationPrompt(candidate: SegmentationAuditCandidate): string {
  const book = books.byCanonicalName[candidate.book] as Book | undefined;
  if (!book) {
    throw new Error(`Unknown book "${candidate.book}" for candidate ${candidate.page}`);
  }
  const skeleton = buildPageSkeleton(book, candidate.section);
  if (!skeleton) {
    throw new Error(`${candidate.page} is not cached (needed to build its page skeleton)`);
  }
  return [
    "You're auditing the segmentation of a Talmud page for talmud.page (an interactive study",
    "tool). Sefaria splits the Gemara into segments and Rashi/Tosafot into comments —",
    "sometimes imperfectly: a segment or comment can bundle two distinct statements that should",
    "be split, or a comment can be needlessly split into two when it's really one continuous",
    "thought. Your job is to find these cases, not fix them — nothing here is applied",
    "automatically; a human reviews every finding.",
    "",
    `Page: ${candidate.page}`,
    "",
    "This page's segments and commentary, for orientation (not full text):",
    formatPageSkeleton(skeleton),
    "",
    "If you need to actually read a specific segment or comment before judging it, the only tool",
    "available to you is context_fetch_cli:",
    "  npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs '[\"<ref>\", ...]'",
    "  npx ts-node rsi_orchestrator/context_fetch_cli.ts get-neighbors \"<segment ref>\" "
      + "[--before N] [--after N]",
    "Each call is capped in size, so ask for specific refs rather than everything at once — for",
    "a page-wide review like this, expect to make more than one call.",
    "",
    "Look specifically for:",
    "1. A single Gemara segment that reads as two or more distinct statements that should",
    "   probably be separate segments.",
    "2. A single Rashi or Tosafot comment that's really two separate comments merged together",
    "   (e.g. two distinct dibbur hamatchil openings, or an unrelated point starting mid-comment).",
    "3. Two adjacent Rashi or Tosafot comments that read as one comment awkwardly split in two.",
    "",
    "Only report genuine issues — most segments and comments are fine as-is. An empty",
    "suggestions array is a completely valid, and probably the most common, response.",
    "",
    'Respond with ONLY a JSON object matching {"suggestions": [{"refs": string[], "issue":',
    'string, "suggestion": string}]}. No other text before or after the JSON.',
  ].join("\n");
}

export function parseJsonResponse<T>(text: string): T {
  const stripped = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(stripped) as T;
}

/** Drops any suggestion referencing a ref that isn't actually on the page — a cheap, local guard
 * against a hallucinated ref, without spending a second model call on it. */
export function dropSuggestionsWithUnknownRefs(
  candidate: SegmentationAuditCandidate, result: AuditResult,
): AuditResult {
  const validRefs = new Set(candidate.boundaryFingerprint.split("|"));
  const suggestions = result.suggestions.filter(suggestion => {
    const valid = suggestion.refs.every(ref => validRefs.has(ref));
    if (!valid) {
      console.error(`Dropping suggestion with an unrecognized ref: ${JSON.stringify(suggestion)}`);
    }
    return valid;
  });
  return {suggestions};
}

async function generateViaClaude(candidate: SegmentationAuditCandidate): Promise<GeneratedAudit> {
  const modelConfig = getTaskModelConfig(TASK_TYPE);
  const result = await runHeadlessClaude(
    generationPrompt(candidate),
    {model: modelConfig.generateModel, allowedTools: CONTEXT_FETCH_ALLOWED_TOOLS});
  recordContextUsage({
    taskType: TASK_TYPE,
    ref: candidate.page,
    callKind: "generate",
    toolUses: result.toolUses,
    costUsd: result.costUsd,
    model: result.model,
  });
  const parsed = parseJsonResponse<AuditResult>(result.text);
  return {
    result: dropSuggestionsWithUnknownRefs(candidate, parsed),
    model: result.model,
    costUsd: result.costUsd,
    contextRefsUsed: extractRequestedRefs(result.toolUses),
  };
}

const OUTPUT_DIR = "precomputed/rsi_state/segmentation_suggestions";

export function writeAuditSuggestions(page: string, result: AuditResult): void {
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  writeJson(`${OUTPUT_DIR}/${page}.json`, result);
}

export function recordGenerationForCandidate(
  candidate: SegmentationAuditCandidate, generated: GeneratedAudit,
): void {
  upsertGenerationRecord(TASK_TYPE, candidate.page, candidate.page, {
    sourceRefs: [candidate.page],
    sourceText: candidate.boundaryFingerprint,
    model: generated.model ?? "unknown",
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    dependsOn: generated.contextRefsUsed,
    costUsd: generated.costUsd,
  });
}

export async function generateAndRecord(
  candidate: SegmentationAuditCandidate,
): Promise<GeneratedAudit> {
  return generateViaClaude(candidate);
}

export interface AuditDeps {
  listCandidates: () => SegmentationAuditCandidate[];
  isFresh: (candidate: SegmentationAuditCandidate) => boolean;
  generate: (candidate: SegmentationAuditCandidate) => Promise<GeneratedAudit>;
  writeSuggestions: (candidate: SegmentationAuditCandidate, result: AuditResult) => void;
  recordGeneration: (candidate: SegmentationAuditCandidate, generated: GeneratedAudit) => void;
}

export async function runSegmentationAudit(deps: AuditDeps): Promise<void> {
  for (const candidate of deps.listCandidates()) {
    if (deps.isFresh(candidate)) continue;
    let generated: GeneratedAudit;
    try {
      // Deliberately sequential — see the same rationale in triage_suggestions.ts.
      // eslint-disable-next-line no-await-in-loop
      generated = await deps.generate(candidate);
    } catch (e) {
      if (e instanceof HeadlessClaudeError && e.isRateLimited) {
        console.error(`Stopping: hit the usage limit (${e.message})`);
        return;
      }
      console.error(`Skipping ${candidate.page}: ${e}`);
      continue;
    }
    deps.writeSuggestions(candidate, generated.result);
    deps.recordGeneration(candidate, generated);
  }
}
