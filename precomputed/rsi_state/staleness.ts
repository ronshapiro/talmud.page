import * as crypto from "crypto";
import {stripHebrewNonletters} from "../../hebrew";

/**
 * Tiered staleness detection for generated artifacts whose source text may have changed under
 * them. Generalizes two things that already exist elsewhere in the codebase: the exact-match
 * normalization used by isUniqueHebrew (api_request_handler.ts) for Tier 0, and the tolerance for
 * punctuation/niqqud noise that the highlight matcher (js/matching.ts) applies when re-anchoring.
 *
 * This module is pure and synchronous — it does not itself make any model calls or shell out to
 * anything. Tier 2 (the ambiguous band) is resolved by the caller via `resolveWithClassification`,
 * which accepts an externally-obtained verdict rather than invoking a classifier itself, so the
 * orchestrator's actual agentic call stays out of this module and this module stays testable
 * without one.
 *
 * Tier 0's normalization is conceptually the same as isUniqueHebrew's
 * (normalizeHebrewForVersionUniqueness in hebrew_text_comparison.ts) but reimplemented with a
 * plain regex tag-strip instead of the DOMPurify-based sanitizeHtml — DOMPurify defends against
 * XSS for rendering, which doesn't apply to offline text comparison, and pulling it in here drags
 * in a jsdom/dompurify chain that isn't otherwise a dependency of this module.
 */
function normalizeForStalenessFingerprint(text: string): string {
  return stripHebrewNonletters(text.replace(/<[^>]*>/g, ""))
    .replace(/[-—–"'״׳,.:;?!]/g, "") // eslint-disable-line unicorn/better-regex
    .replace(/\s\s+/g, " ")
    .trim();
}

export type StalenessStatus = "fresh" | "stale" | "needsClassification";

export interface StalenessResult {
  status: StalenessStatus;
  tier: 0 | 1 | 2 | 3;
  editRatio?: number;
  reason?: string;
}

export interface StalenessThresholds {
  // Edit ratio at or below this is treated as cosmetic (punctuation/niqqud/whitespace-scale
  // drift) and never escalated.
  cosmeticMaxRatio: number;
  // Edit ratio at or above this is treated as a clear rewrite — structurally stale without
  // spending a model call on it.
  structuralMinRatio: number;
}

export const DEFAULT_STALENESS_THRESHOLDS: StalenessThresholds = {
  cosmeticMaxRatio: 0.05,
  structuralMinRatio: 0.4,
};

/** Tier 0 fingerprint: hash of the text normalized the same way isUniqueHebrew compares text. */
export function hashNormalizedText(text: string): string {
  return crypto.createHash("sha256")
    .update(normalizeForStalenessFingerprint(text))
    .digest("hex");
}

/**
 * Levenshtein distance, O(n*m) time / O(min(n,m)) space. Source text at this granularity (a
 * single comment or segment) is short enough that this is cheap.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let previousRow = Array.from({length: short.length + 1}, (_, i) => i);
  for (let i = 1; i <= long.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= short.length; j++) {
      const cost = long[i - 1] === short[j - 1] ? 0 : 1;
      currentRow.push(Math.min(
        previousRow[j] + 1, // deletion
        currentRow[j - 1] + 1, // insertion
        previousRow[j - 1] + cost, // substitution
      ));
    }
    previousRow = currentRow;
  }
  return previousRow[short.length];
}

/** Edit distance normalized to [0, 1] by the longer of the two texts' length. */
export function computeEditRatio(oldText: string, newText: string): number {
  const maxLength = Math.max(oldText.length, newText.length);
  if (maxLength === 0) return 0;
  return editDistance(oldText, newText) / maxLength;
}

/**
 * Tiers 0-1. Returns `needsClassification` (tier 2) for the ambiguous band rather than resolving
 * it — the caller decides whether/how to run the agentic classifier for that ref.
 *
 * `storedSourceText` is the raw source text captured in the artifact's generation record
 * (GenerationRecord.sourceText) at generation time.
 */
export function checkTextStaleness(
  storedSourceText: string,
  currentSourceText: string,
  thresholds: StalenessThresholds = DEFAULT_STALENESS_THRESHOLDS,
): StalenessResult {
  if (hashNormalizedText(currentSourceText) === hashNormalizedText(storedSourceText)) {
    return {status: "fresh", tier: 0};
  }

  const editRatio = computeEditRatio(storedSourceText, currentSourceText);
  if (editRatio <= thresholds.cosmeticMaxRatio) {
    return {status: "fresh", tier: 1, editRatio};
  }
  if (editRatio >= thresholds.structuralMinRatio) {
    return {status: "stale", tier: 3, editRatio, reason: "edit ratio above structural threshold"};
  }
  return {status: "needsClassification", tier: 2, editRatio};
}

/**
 * Resolves a tier-2 `needsClassification` result using a verdict obtained elsewhere (the
 * orchestrator's own agentic call). Log the (editRatio, verdict) pair the caller passes in
 * alongside this result to a generation-record/stats file — that log is what lets the
 * cosmeticMaxRatio / structuralMinRatio thresholds be retuned later instead of staying
 * hand-picked forever.
 */
export function resolveWithClassification(
  pending: StalenessResult,
  classifierVerdict: {stillValid: boolean; reason: string},
): StalenessResult {
  if (pending.status !== "needsClassification") {
    throw new Error(`resolveWithClassification called on a tier-${pending.tier} result that `
      + `wasn't needsClassification`);
  }
  return {
    status: classifierVerdict.stillValid ? "fresh" : "stale",
    tier: 2,
    editRatio: pending.editRatio,
    reason: classifierVerdict.reason,
  };
}

/**
 * Tier 3 structural break via segment count, independent of the text-ratio path above — this is
 * the free signal for "a Rashi comment got split into two" (precomputed/segmentsPerPage.json
 * already tracks segment counts per page).
 */
export function checkSegmentCountStaleness(
  storedSegmentCount: number,
  currentSegmentCount: number,
): StalenessResult {
  if (storedSegmentCount === currentSegmentCount) {
    return {status: "fresh", tier: 0};
  }
  return {
    status: "stale",
    tier: 3,
    reason: `segment count changed from ${storedSegmentCount} to ${currentSegmentCount}`,
  };
}
