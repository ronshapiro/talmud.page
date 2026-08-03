/**
 * Tests for `decideWrapping`, the layout decision pulled out of `TableRow`'s
 * `shouldTranslationWrap` (testability suggestion #4 in FrontendTestabilitySuggestions.md).
 *
 * The DOM measurement around this — writing text into the hidden host and reading `.height()`
 * back — can't be exercised in jsdom (every height reads back as 0, see Observation #2 in
 * FrontendTestingPlan.md), but the decision itself is now a plain function of already-taken
 * measurements, so it can be tested directly with made-up numbers.
 */
import {decideWrapping} from "../TableRow";

describe("decideWrapping", () => {
  test("does not wrap, with a very large clamp, when both heights are 0 (0/0 is NaN)", () => {
    // The jsdom case: every `.height()` reads back 0, so the ratio is 0/0 = NaN.
    const result = decideWrapping({
      hebrewHeight: 0,
      englishHeightAtFullLineCount: 0,
      totalEnglishLines: 10,
      englishHeightAtReducedLineCount: 0,
    });

    expect(result.shouldWrap).toBe(false);
    // Not pinned to the exact fallback constant, just that it's clearly "don't clamp this".
    expect(result.englishLineClampLines).toBeGreaterThan(10000);
  });

  test("a nonzero hebrew height over a zero english height is Infinity, not NaN", () => {
    // Not the jsdom case (which reads every height as 0), but worth pinning: only 0/0 short
    // circuits to the "could not measure" fallback — x/0 for a nonzero x does not.
    const result = decideWrapping({
      hebrewHeight: 100,
      englishHeightAtFullLineCount: 0,
      totalEnglishLines: 10,
      englishHeightAtReducedLineCount: 0,
    });

    expect(result).toEqual({shouldWrap: false, englishLineClampLines: Infinity});
  });

  test("wraps when the hebrew cell is shorter than the reduced-line-count english block", () => {
    const result = decideWrapping({
      hebrewHeight: 50,
      englishHeightAtFullLineCount: 200,
      totalEnglishLines: 10,
      englishHeightAtReducedLineCount: 60,
    });

    expect(result.shouldWrap).toBe(true);
    // heightRatio = 50 / 200 = 0.25; 0.25 * 10 = 2.5, floored to 2.
    expect(result.englishLineClampLines).toBe(2);
  });

  test("does not wrap when the hebrew cell is at least as tall as that english block", () => {
    const result = decideWrapping({
      hebrewHeight: 60,
      englishHeightAtFullLineCount: 200,
      totalEnglishLines: 10,
      englishHeightAtReducedLineCount: 60,
    });

    expect(result.shouldWrap).toBe(false);
  });

  test("englishLineClampLines is the height ratio times the total line count, floored", () => {
    const result = decideWrapping({
      hebrewHeight: 45,
      englishHeightAtFullLineCount: 200,
      totalEnglishLines: 10,
      englishHeightAtReducedLineCount: 60,
    });

    // heightRatio = 45 / 200 = 0.225; 0.225 * 10 = 2.25, floored to 2.
    expect(result.englishLineClampLines).toBe(2);
  });

  test("a zero hebrew height never wraps, even though its ratio is a valid (non-NaN) zero", () => {
    // There's no hebrew to wrap the english around.
    const result = decideWrapping({
      hebrewHeight: 0,
      englishHeightAtFullLineCount: 200,
      totalEnglishLines: 10,
      englishHeightAtReducedLineCount: 60,
    });

    expect(result).toEqual({shouldWrap: false, englishLineClampLines: 0});
  });
});
