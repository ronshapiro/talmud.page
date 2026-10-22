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
import {getTaskModelConfig} from "../precomputed/rsi_state/model_routing";
import {buildPageSkeleton, formatPageSkeleton} from "../precomputed/rsi_state/page_skeleton";
import {
  checkTextStaleness,
  DEFAULT_STALENESS_THRESHOLDS,
  StalenessStatus,
} from "../precomputed/rsi_state/staleness";
import {toFlatArray} from "../sefariaTextType";
import {stripHebrewNonletters} from "../hebrew";
import {stripAbbreviationMarkup, stripExplanations} from "../js/rashi_tosafot_formatting";
import {extractRequestedRefs, findBaseSegment, getCommentRefs} from "./context_fetch";
import {renderPrompt} from "./prompt_template";
import {AgentError, AgentBackend, getAgentRunner} from "./agent_runner";
import {
  extractBase64Images,
  extractBase64ImagesForCritique,
  formatCritiqueImagePlaceholderNote,
  formatGenerationImagePlaceholderNote,
  replaceBase64ImagesWithTempFileLocations,
  restoreBase64ImagesInEdit,
} from "./base64_images";
import {
  continuationCritiquePrompt,
  continuationGenerationPrompt,
  isLongThreadBackend,
  LongThreadSessionManager,
} from "./long_thread_session";

export {LongThreadSessionManager, isLongThreadBackend};

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
// The only tool this task type's headless calls may use — see the module doc above. Scoped to
// this exact command so it can't fall back to arbitrary Bash use.
const CONTEXT_FETCH_ALLOWED_TOOLS = [
  "Bash(npx ts-node rsi_orchestrator/context_fetch_cli.ts *)",
  "Bash(curl *wikipedia.org*)",
];
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
  reason?: string;
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
  // Inference time of this call as reported by the backend, when it reports one (ollama does).
  durationSeconds?: number;
}

export interface GenerationDeps {
  generate: (candidate: TranslationCandidate, priorFeedback?: string) => Promise<GeneratedEdit>;
  critique: (candidate: TranslationCandidate, edit: Edit) => Promise<CritiqueOutcome>;
  shouldStop?: () => boolean;
}

function sumCost(...costs: (number | undefined)[]): number | undefined {
  if (costs.every(c => c === undefined)) return undefined;
  return costs.reduce((total: number, c) => total + (c ?? 0), 0);
}

// Every Rashi/Tosafot comment should end up translated, not just the ones that pass critique on
// the first or second try — so this retries with accumulated feedback well past a single retry.
// Not literally unbounded, though: a persistently bad candidate (or a source text that
// genuinely can't produce a valid edit) would otherwise consume a whole run's budget on its own.
// The only *unbounded* stop is a genuine subscription rate limit, which is deliberately treated
// as "stop the whole run," not "give up on this candidate" — see translateRashiTosafotComments.
export const MAX_GENERATION_ATTEMPTS = 5;

export interface HebrewVerificationResult {
  valid: boolean;
  reason?: string;
}

export function extractHebrewWordsForVerification(text: string): string {
  const withoutExplanations = stripExplanations(text);
  const withoutAbbreviationMarkup = stripAbbreviationMarkup(withoutExplanations);
  return stripHebrewNonletters(withoutAbbreviationMarkup)
    .replace(/IMAGE_PLACEHOLDER_\d+/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[\d#a-z]+;/gi, " ")
    .replace(/[!(),.:;?[\]{}־–—-]/g, " ")
    .replace(/["'׳״]/g, "")
    .replace(/[^\d\s\u05D0-\u05EA]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifyProposedHebrewWording(
  sourceHebrew: string,
  proposedHebrew: string,
): HebrewVerificationResult {
  const withoutExplanations = proposedHebrew.replace(
    /<span\s+class=["']explanation["']>[\S\s]*?<\/span>/gi, "");
  if (/<span\s+class=["']explanation["']>/i.test(withoutExplanations)) {
    return {
      valid: false,
      reason: 'Unclosed <span class="explanation"> tag in proposed Hebrew.',
    };
  }

  const openingAbbreviationCount = (proposedHebrew.match(/<abbr\b[^>]*>/gi) ?? []).length;
  const closingAbbreviationCount = (proposedHebrew.match(/<\/abbr>/gi) ?? []).length;
  if (openingAbbreviationCount !== closingAbbreviationCount) {
    return {
      valid: false,
      reason: `Mismatched <abbr> tags in proposed Hebrew (${openingAbbreviationCount} opening, ${closingAbbreviationCount} closing).`,
    };
  }

  const abbreviationWithoutTitleMatch = proposedHebrew.match(/<abbr(?!\s+title=)[^>]*>/gi);
  if (abbreviationWithoutTitleMatch) {
    return {
      valid: false,
      reason: 'Missing title attribute in <abbr> tag. Use <abbr title="expansion">abbreviation</abbr>.',
    };
  }

  const sourceWords = extractHebrewWordsForVerification(sourceHebrew);
  const proposedWords = extractHebrewWordsForVerification(proposedHebrew);

  if (sourceWords !== proposedWords) {
    return {
      valid: false,
      reason: 'Proposed Hebrew modified the source text outside of <span class="explanation">. '
        + 'Original abbreviations must be preserved inside <abbr title="expansion">abbreviation</abbr>, '
        + 'and any added explanatory words must be wrapped in <span class="explanation">...</span>.',
    };
  }

  return {valid: true};
}

/**
 * Generate, critique, and retry with feedback — across up to MAX_GENERATION_ATTEMPTS attempts —
 * until the critique accepts the result. A malformed (non-JSON) response from `generate` is
 * treated the same as a rejected critique verdict: fed back as the reason for the next attempt,
 * not a fatal error for this candidate — real runs have hit this from the model occasionally
 * returning prose instead of the requested JSON object.
 */
export async function generateWithSelfCritique(
  candidate: TranslationCandidate, deps: GenerationDeps,
): Promise<GeneratedEdit | undefined> {
  let feedback: string | undefined;
  let totalCost: number | undefined;
  let lastReason = "unknown error";
  const {images: candidateImages} = extractBase64Images(
    candidate.hebrewSource,
    {ref: candidate.ref},
  );

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    if (deps.shouldStop?.()) {
      return undefined;
    }
    let generated: GeneratedEdit;
    let outcome: CritiqueOutcome;
    try {
      // eslint-disable-next-line no-await-in-loop
      generated = await deps.generate(candidate, feedback);
      if (candidateImages.length > 0) {
        generated = {
          ...generated,
          edit: restoreBase64ImagesInEdit(generated.edit, candidateImages),
        };
      }
      if (deps.shouldStop?.()) {
        return undefined;
      }
      if (generated.edit.hebrew) {
        const hebrewVerification = verifyProposedHebrewWording(
          candidate.hebrewSource, generated.edit.hebrew);
        if (!hebrewVerification.valid) {
          totalCost = sumCost(totalCost, generated.costUsd);
          lastReason = hebrewVerification.reason!;
          feedback = lastReason;
          continue;
        }
      }
      // eslint-disable-next-line no-await-in-loop
      outcome = await deps.critique(candidate, generated.edit);
    } catch (e) {
      if (e instanceof AgentError && e.isCancelled) throw e;
      if (deps.shouldStop?.()) return undefined;
      if (e instanceof AgentError && e.isRateLimited) throw e;
      lastReason = `Your previous response errored rather than producing a usable result: ${e}. `
        + "Respond with ONLY a JSON object with \"hebrew\" and/or \"english\" string fields — "
        + "no other text.";
      feedback = lastReason;
      continue;
    }
    totalCost = sumCost(totalCost, generated.costUsd, outcome.costUsd);
    if (outcome.verdict.valid) {
      // Only the final, accepted generate+critique pair's context counts — a rejected attempt's
      // fetches didn't contribute to what actually shipped.
      const contextRefsUsed = Array.from(
        new Set([...generated.contextRefsUsed, ...outcome.contextRefsUsed]));
      return {...generated, costUsd: totalCost, contextRefsUsed};
    }
    lastReason = outcome.verdict.reason ?? "Critique rejected the edit";
    feedback = lastReason;
  }
  console.error(
    `Giving up on ${candidate.ref} after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastReason}`);
  return undefined;
}

export interface TranslationRunResult {
  rateLimited: boolean;
  rateLimitError?: AgentError;
  candidatesProcessed: number;
  stoppedDueToDeadline?: boolean;
  stoppedDueToSignal?: boolean;
}

export interface TranslationDeps {
  listCandidates: () => TranslationCandidate[];
  isFresh: (candidate: TranslationCandidate) => boolean;
  // May reject — translateRashiTosafotComments stops the whole run on an AgentError with
  // isRateLimited, and skips just this candidate on any other error.
  generate: (candidate: TranslationCandidate) => Promise<GeneratedEdit | undefined>;
  writeEdit: (candidate: TranslationCandidate, edit: Edit) => void;
  recordGeneration: (candidate: TranslationCandidate, generated: GeneratedEdit) => void;
  shouldStop?: () => boolean;
}

export async function translateRashiTosafotComments(
  deps: TranslationDeps,
): Promise<TranslationRunResult> {
  let candidatesProcessed = 0;
  for (const candidate of deps.listCandidates()) {
    if (deps.shouldStop?.()) {
      return {rateLimited: false, candidatesProcessed, stoppedDueToDeadline: true};
    }
    if (deps.isFresh(candidate)) continue;
    let generated;
    try {
      // Deliberately sequential — see the same rationale in triage_suggestions.ts.
      // eslint-disable-next-line no-await-in-loop
      generated = await deps.generate(candidate);
    } catch (e) {
      if (e instanceof AgentError && e.isCancelled) {
        return {
          rateLimited: false,
          candidatesProcessed,
          stoppedDueToDeadline: true,
          stoppedDueToSignal: true,
        };
      }
      if (deps.shouldStop?.()) {
        return {rateLimited: false, candidatesProcessed, stoppedDueToDeadline: true};
      }
      if (e instanceof AgentError && e.isRateLimited) {
        // Every remaining candidate would fail against the same wall — stop the run rather than
        // burn through it logging the identical failure. Subscription usage limits are the
        // expected budget signal under self-hosted billing; see RecursiveSelfImprovingAgentPlan.md.
        console.error(`Stopping: hit the usage limit (${e.message})`);
        return {rateLimited: true, rateLimitError: e, candidatesProcessed};
      }
      console.error(`Skipping ${candidate.ref}: ${e}`);
      continue;
    }
    if (!generated) continue;
    deps.writeEdit(candidate, {...generated.edit, status: "pending"});
    deps.recordGeneration(candidate, generated);
    candidatesProcessed++;
  }
  return {rateLimited: false, candidatesProcessed};
}

export interface ContinuousTranslationDeps {
  listCandidates: () => TranslationCandidate[];
  isFresh: (candidate: TranslationCandidate) => boolean;
  generate: (candidate: TranslationCandidate) => Promise<GeneratedEdit | undefined>;
  writeEdit: (candidate: TranslationCandidate, edit: Edit) => void;
  recordGeneration: (candidate: TranslationCandidate, generated: GeneratedEdit) => void;
  onProgress?: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  durationMs: number;
  checkIntervalMs?: number;
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
  shouldStop?: () => boolean;
  signal?: AbortSignal;
}

export interface ContinuousTranslationSummary {
  totalProcessed: number;
  totalPauses: number;
  stoppedReason: "duration_elapsed" | "all_completed" | "stopped_by_signal";
}

export const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Runs translation continuously for a specified duration (e.g. 24 hours), processing as many
 * candidates as possible. When agent quota/rate limits are encountered, it pauses and checks
 * hourly, resuming candidate translation as soon as quota is restored.
 */
export async function runContinuousTranslation(
  deps: ContinuousTranslationDeps,
): Promise<ContinuousTranslationSummary> {
  const now = deps.now ?? Date.now;
  const isStopping = () => Boolean(deps.shouldStop?.() || deps.signal?.aborted);

  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => {
    if (isStopping()) {
      resolve();
      return;
    }
    let interval: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      if (interval) clearInterval(interval);
      resolve();
    }, ms);
    const abortHandler = () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
      resolve();
    };
    if (deps.signal) {
      deps.signal.addEventListener("abort", abortHandler, {once: true});
    }
    interval = setInterval(() => {
      if (isStopping()) {
        abortHandler();
      }
    }, 100);
    if (typeof (interval as any)?.unref === "function") {
      (interval as any).unref();
    }
  }));

  const checkIntervalMs = deps.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
  const logger = deps.logger ?? console;

  const startTime = now();
  const deadline = startTime + deps.durationMs;
  let totalProcessed = 0;
  let totalPauses = 0;

  logger.log(
    `Starting continuous translation mode for ${deps.durationMs / 3600000} hours `
    + `(until ${new Date(deadline).toISOString()}), checking quota every `
    + `${Math.round(checkIntervalMs / 60000)} minutes on exhaustion.`);

  while (now() < deadline) {
    if (isStopping()) {
      logger.log("Stop signal received. Stopping continuous translation.");
      return {totalProcessed, totalPauses, stoppedReason: "stopped_by_signal"};
    }

    const unFreshCandidates = deps.listCandidates().filter(c => !deps.isFresh(c));
    if (unFreshCandidates.length === 0) {
      logger.log("All candidates are up to date. Finished.");
      if (deps.onProgress) {
        // eslint-disable-next-line no-await-in-loop
        await deps.onProgress();
      }
      return {totalProcessed, totalPauses, stoppedReason: "all_completed"};
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await translateRashiTosafotComments({
      listCandidates: () => unFreshCandidates,
      isFresh: deps.isFresh,
      generate: deps.generate,
      writeEdit: deps.writeEdit,
      recordGeneration: deps.recordGeneration,
      shouldStop: () => isStopping() || now() >= deadline,
    });

    totalProcessed += result.candidatesProcessed;

    if (result.candidatesProcessed > 0 && deps.onProgress) {
      // eslint-disable-next-line no-await-in-loop
      await deps.onProgress();
    }

    if (isStopping() || result.stoppedDueToSignal) {
      logger.log("Stop signal received. Stopping continuous translation.");
      return {totalProcessed, totalPauses, stoppedReason: "stopped_by_signal"};
    }

    if (now() >= deadline) {
      logger.log(`Reached duration limit (${deps.durationMs / 3600000} hours). Stopping.`);
      return {totalProcessed, totalPauses, stoppedReason: "duration_elapsed"};
    }

    if (result.rateLimited) {
      if (deps.onProgress) {
        // eslint-disable-next-line no-await-in-loop
        await deps.onProgress();
      }
      const remainingMs = deadline - now();
      if (remainingMs <= 0) {
        logger.log("Quota exhausted and duration limit reached. Stopping.");
        return {totalProcessed, totalPauses, stoppedReason: "duration_elapsed"};
      }
      const sleepMs = Math.min(checkIntervalMs, remainingMs);
      totalPauses++;
      const resumeAt = new Date(now() + sleepMs).toISOString();
      logger.log(
        `Quota exhausted (${result.rateLimitError?.message ?? "rate limited"}). `
        + `Pausing for ${Math.round(sleepMs / 60000)} minutes until `
        + `${resumeAt} to check quota availability.`);
      // eslint-disable-next-line no-await-in-loop
      await sleep(sleepMs);
      if (isStopping()) {
        logger.log("Stop signal received while paused. Stopping continuous translation.");
        return {totalProcessed, totalPauses, stoppedReason: "stopped_by_signal"};
      }
      if (now() >= deadline) {
        logger.log("Duration limit reached while paused. Stopping.");
        return {totalProcessed, totalPauses, stoppedReason: "duration_elapsed"};
      }
      logger.log(`Resuming at ${new Date(now()).toISOString()} and checking quota availability...`);
    } else {
      const remaining = deps.listCandidates().filter(c => !deps.isFresh(c));
      if (remaining.length === 0) {
        logger.log("All candidates have been translated and recorded. Exiting.");
        if (deps.onProgress) {
          // eslint-disable-next-line no-await-in-loop
          await deps.onProgress();
        }
        return {totalProcessed, totalPauses, stoppedReason: "all_completed"};
      }
    }
  }

  logger.log(`Reached duration limit (${deps.durationMs / 3600000} hours). Stopping.`);
  return {totalProcessed, totalPauses, stoppedReason: "duration_elapsed"};
}

function hebrewText(comment: ApiComment): string {
  return toFlatArray(comment.he).join(" ");
}

export interface CandidateListOptions {
  startPage?: string;
}

export interface AllBooksCandidateListOptions {
  startBook?: string;
  startPage?: string;
}

function parseAmud(amud: string): {daf: number; side: string} {
  const match = /^(\d+)([ab]?)$/.exec(amud.trim());
  if (!match) return {daf: 0, side: "a"};
  return {
    daf: parseInt(match[1], 10),
    side: match[2] || "a",
  };
}

export function compareAmudim(a: string, b: string): number {
  const pa = parseAmud(a);
  const pb = parseAmud(b);
  if (pa.daf !== pb.daf) return pa.daf - pb.daf;
  return pa.side.localeCompare(pb.side);
}

export function filterSectionsFromStartPage(
  sections: Iterable<string>,
  startPage: string,
): string[] {
  const allSections = Array.from(sections);
  const normalized = /^\d+$/.test(startPage.trim())
    ? `${startPage.trim()}a`
    : startPage.trim();
  const directIdx = allSections.indexOf(normalized);
  if (directIdx !== -1) {
    return allSections.slice(directIdx);
  }
  const cmpIdx = allSections.findIndex(s => compareAmudim(s, normalized) >= 0);
  if (cmpIdx !== -1) {
    return allSections.slice(cmpIdx);
  }
  return [];
}

export function listCandidatesForBook(
  book: Book,
  options?: CandidateListOptions,
): TranslationCandidate[] {
  const candidates: TranslationCandidate[] = [];
  const sections = options?.startPage
    ? filterSectionsFromStartPage(book.sections, options.startPage)
    : Array.from(book.sections);
  for (const section of sections) {
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

export function listCandidatesForAllBooks(
  options?: AllBooksCandidateListOptions,
): TranslationCandidate[] {
  const all: TranslationCandidate[] = [];
  const allBooksList = Array.from(books.allBooks);
  let started = !options?.startBook;

  for (const book of allBooksList) {
    if (!started) {
      if (book.canonicalName === options?.startBook) {
        started = true;
      } else {
        continue;
      }
    }
    const isFirstBook = book.canonicalName === options?.startBook;
    const startPageForBook = isFirstBook ? options?.startPage : undefined;
    all.push(...listCandidatesForBook(book, {startPage: startPageForBook}));
  }
  return all;
}

export function isFreshTranslation(
  candidate: TranslationCandidate,
): boolean {
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
    hebrewSource: "מתני' כ\"א תקיעות מפרש להו בפ' החליל",
    hebrew: "<strong class=\"dibur-hamatchil\"><abbr title=\"מתניתין\">מתני'</abbr></strong> - "
      + "<abbr title=\"עשרים ואחת\">כ\"א</abbr> תקיעות, <span class=\"explanation\">הגמרא</span> "
      + "מפרש להו <abbr title=\"בפרק\">בפ'</abbr> החליל:",
    english: "<strong class=\"dibur-hamatchil\">The Mishnah:</strong> Twenty-one blasts — "
      + "[the Gemara] explains them in the chapter [entitled] Hechalil:",
  },
  Tosafot: {
    hebrewSource: "וכן משמע בכל דוכתא אא\"כ פירש",
    hebrew: "<strong class=\"dibur-hamatchil\">וכן משמע</strong> - בכל דוכתא, "
      + "<abbr title=\"אלא אם כן\">אא\"כ</abbr> פירש <span class=\"explanation\">רבו</span>:",
    english: "<strong class=\"dibur-hamatchil\">And so it implies:</strong> in every place, "
      + "unless [his teacher] explained otherwise.",
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
      examples.push({
        hebrewSource: replaceBase64ImagesWithTempFileLocations(record.sourceText, {ref}),
        hebrew: edit.hebrew !== undefined
          ? replaceBase64ImagesWithTempFileLocations(edit.hebrew, {ref})
          : undefined,
        english: edit.english !== undefined
          ? replaceBase64ImagesWithTempFileLocations(edit.english, {ref})
          : undefined,
      });
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

/** Shared by the first-turn and long-thread continuation prompts. */
export function targetComment(
  candidate: TranslationCandidate, hebrewSource: string, imageNote: string | undefined,
): string {
  const segment = findBaseSegment(candidate.ref);
  const nested = Object.entries(getCommentRefs(candidate.ref).commentary)
    .map(([name, refs]) => `${name}: ${refs.join(", ")}`);
  return renderPrompt("target_comment.md", {
    segmentLine: segment && `Attached Gemara segment (${segment.ref}): ${segment.he}`,
    segmentEnglishLine: segment?.en && `Existing English of that segment: ${segment.en}`,
    nestedLine: nested.length > 0 ? `Commentary on this comment: ${nested.join("; ")}` : undefined,
    commentRef: candidate.ref,
    commentator: candidate.commentator,
    hebrewSource,
    imageNote,
  });
}

export function generationPrompt(candidate: TranslationCandidate, priorFeedback?: string): string {
  const book = books.byCanonicalName[candidate.book] as Book | undefined;
  if (!book) {
    throw new Error(`Unknown book "${candidate.book}" for candidate ${candidate.ref}`);
  }
  // listCandidatesForBook only produces a candidate for a page whose cached file already exists,
  // so a missing skeleton here means the cache was deleted/moved out from under a run in
  // progress — a real inconsistency worth failing loudly on, not a degraded-but-still-plausible
  // prompt.
  const skeleton = buildPageSkeleton(book, candidate.section);
  if (!skeleton) {
    throw new Error(`${candidate.page} is not cached (needed to build its page skeleton)`);
  }
  const examples = findWorkedExamples(candidate.commentator, candidate.ref);
  const workedExamples = examples.length > 0
    ? examples : [FALLBACK_WORKED_EXAMPLE[candidate.commentator]];
  const extractedImages = extractBase64Images(candidate.hebrewSource, {ref: candidate.ref});
  const hebrewSourceWithPlaceholders = extractedImages.textWithPlaceholders;
  const imageNote = formatGenerationImagePlaceholderNote(extractedImages.images);

  return renderPrompt("translation_generation.md", {
    workedExamples: formatWorkedExamples(workedExamples),
    pageIndex: formatPageSkeleton(skeleton),
    targetComment: targetComment(candidate, hebrewSourceWithPlaceholders, imageNote),
    priorFeedback: priorFeedback
      && `Your previous attempt was rejected for this reason — fix it: ${priorFeedback}`,
  });
}

export function critiquePrompt(candidate: TranslationCandidate, edit: Edit): string {
  const {
    originalHebrewWithPlaceholders,
    proposedHebrewWithPlaceholders,
    proposedEnglishWithPlaceholders,
    images,
  } = extractBase64ImagesForCritique(candidate.hebrewSource, edit, candidate.ref);
  const imageNote = formatCritiqueImagePlaceholderNote(images);

  return renderPrompt("translation_critique.md", {
    originalHebrew: originalHebrewWithPlaceholders,
    proposedHebrew: proposedHebrewWithPlaceholders,
    proposedEnglish: proposedEnglishWithPlaceholders,
    imageNote,
  });
}

export function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim();
  // Defensive against an occasional markdown code fence around the JSON.
  const stripped = trimmed.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    return JSON.parse(stripped) as T;
  } catch (e) {
    // If there is preamble or postamble, extract the first outermost {...} block.
    const match = stripped.match(/{[\S\s]*}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw e;
  }
}

export interface TaskExecutionOptions {
  backend?: AgentBackend;
  // Backend used for critique, if different from `backend` (e.g. agy judging ollama output).
  critiqueBackend?: AgentBackend;
  model?: string;
  critiqueModel?: string;
  modelConfig?: string;
  debug?: boolean;
  onSubcommand?: (command: string) => void;
  sessionManager?: LongThreadSessionManager;
  signal?: AbortSignal;
  shouldStop?: () => boolean;
}

export async function generateViaAgent(
  candidate: TranslationCandidate,
  priorFeedback?: string,
  options?: TaskExecutionOptions,
): Promise<GeneratedEdit> {
  const modelConfig = getTaskModelConfig(TASK_TYPE, {
    configName: options?.modelConfig,
    backend: options?.backend,
  });
  const backend = options?.backend ?? modelConfig?.backend;
  if (!backend) {
    throw new Error("No backend configured for generation");
  }
  const model = options?.model ?? modelConfig.generateModel;
  const runner = getAgentRunner(backend);
  if (options?.debug) {
    console.log(`  [generate] running ${backend} (${model ?? "default model"})...`);
  }

  const {images} = extractBase64Images(candidate.hebrewSource, {ref: candidate.ref});
  const isLongThread = isLongThreadBackend(backend);
  let promptText = generationPrompt(candidate, priorFeedback);
  let sessionId: string | undefined;
  let resumeSession = false;

  if (isLongThread && options?.sessionManager) {
    const sessionInfo = options.sessionManager.prepareGenerateSession(
      candidate,
      backend,
      Boolean(priorFeedback),
    );
    sessionId = sessionInfo.sessionId;
    resumeSession = sessionInfo.isResume;
    promptText = resumeSession
      ? continuationGenerationPrompt(candidate)
      : generationPrompt(candidate, priorFeedback);
  }

  if (backend === "ollama") {
    promptText += "\n\nNo tools or lookups are available in this environment — ignore the tool "
      + "instructions above and translate from the provided text and your own knowledge.";
  }

  const result = await runner(
    promptText,
    {
      model,
      allowedTools: CONTEXT_FETCH_ALLOWED_TOOLS,
      debug: options?.debug,
      sessionId,
      resumeSession,
      signal: options?.signal,
      images: images.length > 0 ? images : undefined,
      onToolUse: (toolUse) => {
        const command = (toolUse.input as {command?: string; CommandLine?: string})?.command
          ?? (toolUse.input as {command?: string; CommandLine?: string})?.CommandLine;
        if (command) {
          options?.onSubcommand?.(command);
        }
      },
    });
  const finalModel = result.model ?? model;
  if (isLongThread && options?.sessionManager) {
    options.sessionManager.recordGenerateResult(result.sessionId, result.totalTokens);
  }
  recordContextUsage({
    taskType: TASK_TYPE,
    ref: candidate.ref,
    callKind: "generate",
    toolUses: result.toolUses,
    costUsd: result.costUsd,
    model: finalModel,
  }, candidate.page);
  const parsedEdit = parseJsonResponse<Edit>(result.text);
  return {
    edit: restoreBase64ImagesInEdit(parsedEdit, images),
    model: finalModel,
    costUsd: result.costUsd,
    contextRefsUsed: extractRequestedRefs(result.toolUses),
    durationSeconds: result.durationSeconds,
  };
}

export async function critiqueViaAgent(
  candidate: TranslationCandidate,
  edit: Edit,
  options?: TaskExecutionOptions,
): Promise<CritiqueOutcome> {
  const modelConfig = getTaskModelConfig(TASK_TYPE, {
    configName: options?.modelConfig,
    backend: options?.backend,
  });
  const critiqueBackend = options?.critiqueBackend
    ?? modelConfig?.critiqueBackend
    ?? options?.backend
    ?? modelConfig?.backend;
  if (!critiqueBackend) {
    throw new Error("No backend configured for critique");
  }
  const critiqueBackendConfig = options?.critiqueBackend
    ? getTaskModelConfig(TASK_TYPE, {backend: options.critiqueBackend})
    : undefined;
  const model = options?.critiqueModel
    ?? (modelConfig?.critiqueBackend ? modelConfig.critiqueModel : undefined)
    ?? critiqueBackendConfig?.critiqueModel
    ?? (options?.modelConfig
      ? modelConfig.critiqueModel
      : (options?.model ?? modelConfig.critiqueModel));
  const runner = getAgentRunner(critiqueBackend);
  if (options?.debug) {
    console.log(`  [critique] running ${critiqueBackend} (${model ?? "default model"})...`);
  }

  const {images} = extractBase64ImagesForCritique(candidate.hebrewSource, edit, candidate.ref);
  const isLongThread = isLongThreadBackend(critiqueBackend);
  let promptText = critiquePrompt(candidate, edit);
  let sessionId: string | undefined;
  let resumeSession = false;

  if (isLongThread && options?.sessionManager) {
    const sessionInfo = options.sessionManager.prepareCritiqueSession(critiqueBackend);
    sessionId = sessionInfo.sessionId;
    resumeSession = sessionInfo.isResume;
    promptText = resumeSession
      ? continuationCritiquePrompt(candidate, edit)
      : critiquePrompt(candidate, edit);
  }

  const result = await runner(
    promptText,
    {
      model,
      allowedTools: CONTEXT_FETCH_ALLOWED_TOOLS,
      debug: options?.debug,
      sessionId,
      resumeSession,
      signal: options?.signal,
      images: images.length > 0 ? images : undefined,
      onToolUse: (toolUse) => {
        const command = (toolUse.input as {command?: string; CommandLine?: string})?.command
          ?? (toolUse.input as {command?: string; CommandLine?: string})?.CommandLine;
        if (command) {
          options?.onSubcommand?.(command);
        }
      },
    });
  const finalModel = result.model ?? model;
  const verdict = parseJsonResponse<CritiqueVerdict>(result.text);
  const outcome: CritiqueOutcome = {
    verdict,
    costUsd: result.costUsd,
    contextRefsUsed: extractRequestedRefs(result.toolUses),
  };
  if (isLongThread && options?.sessionManager) {
    options.sessionManager.recordCritiqueOutcome(outcome, result.sessionId, result.totalTokens);
  }
  recordContextUsage({
    taskType: TASK_TYPE,
    ref: candidate.ref,
    callKind: "critique",
    toolUses: result.toolUses,
    costUsd: result.costUsd,
    model: finalModel,
  }, candidate.page);
  return outcome;
}

export async function generateAndRecord(
  candidate: TranslationCandidate,
  options?: TaskExecutionOptions,
): Promise<GeneratedEdit | undefined> {
  const isLongThread = isLongThreadBackend(options?.backend);
  const sessionManager = options?.sessionManager
    ?? (isLongThread ? new LongThreadSessionManager() : undefined);
  const effectiveOptions: TaskExecutionOptions = {
    ...options,
    sessionManager,
  };

  try {
    return await generateWithSelfCritique(candidate, {
      shouldStop: options?.shouldStop,
      generate: (currentCandidate, priorFeedback) => {
        if (effectiveOptions.debug && priorFeedback) {
          console.log(`  [retry] feedback from previous attempt: ${priorFeedback}`);
        }
        return generateViaAgent(currentCandidate, priorFeedback, effectiveOptions);
      },
      critique: async (currentCandidate, edit) => {
        const outcome = await critiqueViaAgent(currentCandidate, edit, effectiveOptions);
        if (effectiveOptions.debug) {
          if (outcome.verdict.valid) {
            console.log(`  [critique] accepted`);
          } else {
            console.log(`  [critique] rejected: ${outcome.verdict.reason ?? "(no reason provided)"}`);
          }
        }
        return outcome;
      },
    });
  } catch (error) {
    if (sessionManager) {
      sessionManager.reset();
    }
    throw error;
  }
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
