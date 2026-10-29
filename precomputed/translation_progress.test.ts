import {
  getTranslationProgress,
  SEDER_ORDER,
  TALMUD_TRACTATE_NAMES,
  TranslationProgressData,
} from "./translation_progress_data";

describe("translation_progress", () => {
  let progressData: TranslationProgressData;

  beforeAll(() => {
    progressData = getTranslationProgress();
  });

  test("contains progress summary with all expected fields", () => {
    const {summary} = progressData;
    expect(summary).toBeDefined();
    expect(summary.totalPages).toBe(5392);
    expect(summary.completePages).toBeGreaterThan(0);
    expect(summary.partialPages).toBeGreaterThan(0);
    expect(summary.notStartedPages).toBeGreaterThan(0);
    expect(summary.totalComments).toBeGreaterThan(100000);
    expect(summary.translatedComments).toBeGreaterThan(20000);

    const pagesSum = (
      summary.completePages
      + summary.partialPages
      + summary.notStartedPages
      + summary.noCommentsPages
    );
    expect(pagesSum).toBe(summary.totalPages);
  });

  test("contains all 38 Talmud tractates in correct order", () => {
    expect(progressData.masechtot.length).toBe(38);
    const masechetNames = progressData.masechtot.map(masechet => masechet.canonicalName);
    expect(masechetNames).toEqual(TALMUD_TRACTATE_NAMES);
  });

  test("each masechet has consistent page counts and valid sedarim", () => {
    for (const masechet of progressData.masechtot) {
      expect(SEDER_ORDER[masechet.canonicalName]).toBeDefined();
      expect(masechet.seder).toBe(SEDER_ORDER[masechet.canonicalName].seder);
      expect(masechet.sederHebrew).toBe(SEDER_ORDER[masechet.canonicalName].sederHebrew);

      expect(masechet.pages.length).toBe(masechet.totalPages);

      const masechetPagesSum = (
        masechet.completePages
        + masechet.partialPages
        + masechet.notStartedPages
        + masechet.noCommentsPages
      );
      expect(masechetPagesSum).toBe(masechet.totalPages);
      expect(masechet.translatedComments).toBeLessThanOrEqual(masechet.totalComments);
    }
  });

  test("verifies known tractates progress", () => {
    const roshHashanah = progressData.masechtot.find(
      masechet => masechet.canonicalName === "Rosh Hashanah",
    );
    expect(roshHashanah).toBeDefined();
    expect(roshHashanah!.totalPages).toBe(67);
    expect(roshHashanah!.completePages).toBe(67);
    expect(roshHashanah!.partialPages).toBe(0);
    expect(roshHashanah!.notStartedPages).toBe(0);
    expect(roshHashanah!.percentCompletePages).toBe(100);

    const berakhot = progressData.masechtot.find(
      masechet => masechet.canonicalName === "Berakhot",
    );
    expect(berakhot).toBeDefined();
    expect(berakhot!.totalPages).toBe(125);
    expect(berakhot!.completePages).toBe(81);
    expect(berakhot!.partialPages).toBe(18);
    expect(berakhot!.notStartedPages).toBe(26);
  });
});
