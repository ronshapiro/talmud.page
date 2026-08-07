import {
  checkSegmentCountStaleness,
  checkTextStaleness,
  computeEditRatio,
  DEFAULT_STALENESS_THRESHOLDS,
  editDistance,
  hashNormalizedText,
  resolveWithClassification,
} from "./staleness";

test("editDistance is 0 for identical strings", () => {
  expect(editDistance("שלום", "שלום")).toBe(0);
});

test("editDistance counts a single substitution", () => {
  expect(editDistance("abc", "abd")).toBe(1);
});

test("editDistance counts insertions and deletions", () => {
  expect(editDistance("abc", "abcd")).toBe(1);
  expect(editDistance("abcd", "abc")).toBe(1);
});

test("computeEditRatio is 0 for identical text", () => {
  expect(computeEditRatio("hello world", "hello world")).toBe(0);
});

test("computeEditRatio is 0 for two empty strings", () => {
  expect(computeEditRatio("", "")).toBe(0);
});

test("hashNormalizedText is stable across punctuation-only differences", () => {
  expect(hashNormalizedText("שלום, עולם!"))
    .toBe(hashNormalizedText("שלום עולם"));
});

test("hashNormalizedText differs on a real word change", () => {
  expect(hashNormalizedText("שלום עולם"))
    .not.toBe(hashNormalizedText("שלום ירושלים"));
});

test("checkTextStaleness Tier 0: cosmetic-only change (punctuation/whitespace) is fresh", () => {
  const result = checkTextStaleness("שלום, עולם!", "שלום עולם");
  expect(result).toEqual({status: "fresh", tier: 0});
});

test("checkTextStaleness Tier 1: small real edit under the cosmetic threshold is fresh", () => {
  const stored = "a".repeat(100);
  const current = `${"a".repeat(97)}bbb`; // ~3% edit ratio once padded — see ratio math below
  const result = checkTextStaleness(stored, current, DEFAULT_STALENESS_THRESHOLDS);
  expect(result.tier).toBe(1);
  expect(result.status).toBe("fresh");
  expect(result.editRatio).toBeLessThanOrEqual(DEFAULT_STALENESS_THRESHOLDS.cosmeticMaxRatio);
});

test("checkTextStaleness Tier 2: mid-range edit needs classification", () => {
  const stored = "The quick brown fox jumps over the lazy dog and keeps running";
  const current = "The quick brown fox leaps over the lazy dog and keeps walking";
  const result = checkTextStaleness(stored, current, DEFAULT_STALENESS_THRESHOLDS);
  expect(result.status).toBe("needsClassification");
  expect(result.tier).toBe(2);
  expect(result.editRatio).toBeGreaterThan(DEFAULT_STALENESS_THRESHOLDS.cosmeticMaxRatio);
  expect(result.editRatio).toBeLessThan(DEFAULT_STALENESS_THRESHOLDS.structuralMinRatio);
});

test("checkTextStaleness Tier 3: large rewrite is stale without classification", () => {
  const result = checkTextStaleness(
    "This is the original commentary text about the sugya.",
    "Completely different content that shares almost nothing with before.",
    DEFAULT_STALENESS_THRESHOLDS,
  );
  expect(result.status).toBe("stale");
  expect(result.tier).toBe(3);
});

test("resolveWithClassification marks stillValid as fresh at tier 2", () => {
  const pending = checkTextStaleness(
    "The quick brown fox jumps over the lazy dog and keeps running",
    "The quick brown fox leaps over the lazy dog and keeps walking",
  );
  const resolved = resolveWithClassification(
    pending, {stillValid: true, reason: "meaning preserved"});
  expect(resolved).toEqual({
    status: "fresh",
    tier: 2,
    editRatio: pending.editRatio,
    reason: "meaning preserved",
  });
});

test("resolveWithClassification marks !stillValid as stale at tier 2", () => {
  const pending = checkTextStaleness(
    "The quick brown fox jumps over the lazy dog and keeps running",
    "The quick brown fox leaps over the lazy dog and keeps walking",
  );
  const resolved = resolveWithClassification(
    pending, {stillValid: false, reason: "meaning changed"});
  expect(resolved.status).toBe("stale");
});

test("resolveWithClassification throws when called on a non-pending result", () => {
  const fresh = checkTextStaleness("same text same text", "same text same text");
  expect(() => resolveWithClassification(fresh, {stillValid: true, reason: "n/a"}))
    .toThrow();
});

test("checkSegmentCountStaleness: unchanged count is fresh", () => {
  expect(checkSegmentCountStaleness(5, 5)).toEqual({status: "fresh", tier: 0});
});

test("checkSegmentCountStaleness: changed count is a Tier 3 structural break", () => {
  const result = checkSegmentCountStaleness(5, 6);
  expect(result.status).toBe("stale");
  expect(result.tier).toBe(3);
  expect(result.reason).toContain("5");
  expect(result.reason).toContain("6");
});
