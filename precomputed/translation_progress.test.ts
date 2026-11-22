import {Amud} from "../apiTypes";
import {readUtf8} from "../files";
import {aiEditsForPage} from "./ai_edits";
import {
  computeProgressSummary,
  countPageTranslations,
  extractPageCommentaryIndex,
  getTranslationProgress,
  MasechetProgress,
  PageCommentaryIndex,
  RASHI_TOSAFOT_COMMENTS_PER_PAGE_PATH,
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
    expect(summary.totalPages).toBe(5333);
    expect(summary.noCommentsPages).toBe(12);
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

  test("keeps zero-comment tractates visible while excluding them from summary totals", () => {
    const tamid = progressData.masechtot.find(masechet => masechet.canonicalName === "Tamid");
    const shekalim = progressData.masechtot.find(
      masechet => masechet.canonicalName === "Shekalim",
    );

    expect(tamid).toBeDefined();
    expect(tamid!.totalComments).toBe(0);
    expect(tamid!.notStartedPages).toBe(0);
    expect(tamid!.noCommentsPages).toBe(tamid!.totalPages);

    expect(shekalim).toBeDefined();
    expect(shekalim!.totalComments).toBe(0);
    expect(shekalim!.notStartedPages).toBe(0);
    expect(shekalim!.noCommentsPages).toBe(shekalim!.totalPages);

    const candidateTractates = progressData.masechtot.filter(
      masechet => masechet.totalComments > 0,
    );
    const expectedTotalPages = candidateTractates.reduce(
      (sum, masechet) => sum + masechet.totalPages,
      0,
    );
    const expectedNoCommentsPages = candidateTractates.reduce(
      (sum, masechet) => sum + masechet.noCommentsPages,
      0,
    );
    expect(progressData.summary.totalPages).toBe(expectedTotalPages);
    expect(progressData.summary.noCommentsPages).toBe(expectedNoCommentsPages);
  });

  test("computeProgressSummary skips zero-comment tractates", () => {
    const candidateMasechet: MasechetProgress = {
      canonicalName: "Horayot",
      hebrewName: "הוריות",
      seder: "Nezikin",
      sederHebrew: "נזיקין",
      totalPages: 25,
      completePages: 10,
      partialPages: 5,
      notStartedPages: 9,
      noCommentsPages: 1,
      totalComments: 100,
      translatedComments: 50,
      percentCompletePages: 40,
      percentTranslatedComments: 50,
      pages: [],
    };
    const zeroCommentMasechet: MasechetProgress = {
      canonicalName: "Tamid",
      hebrewName: "תמיד",
      seder: "Kodashim",
      sederHebrew: "קדשים",
      totalPages: 17,
      completePages: 0,
      partialPages: 0,
      notStartedPages: 0,
      noCommentsPages: 17,
      totalComments: 0,
      translatedComments: 0,
      percentCompletePages: 0,
      percentTranslatedComments: 0,
      pages: [],
    };

    const computedSummary = computeProgressSummary(
      [candidateMasechet, zeroCommentMasechet],
      "2026-11-22T00:00:00.000Z",
    );

    expect(computedSummary).toEqual({
      totalPages: 25,
      completePages: 10,
      partialPages: 5,
      notStartedPages: 9,
      noCommentsPages: 1,
      totalComments: 100,
      translatedComments: 50,
      percentCompletePages: 40,
      percentTranslatedComments: 50,
      updatedAt: "2026-11-22T00:00:00.000Z",
    });
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

  test("contains translation timeline over time", () => {
    expect(progressData.timeline).toBeDefined();
    expect(progressData.timeline.length).toBeGreaterThan(0);

    const firstPoint = progressData.timeline[0];
    const lastPoint = progressData.timeline[progressData.timeline.length - 1];

    expect(firstPoint.date).toBeDefined();
    expect(firstPoint.cumulativeCount).toBeGreaterThan(0);
    expect(lastPoint.cumulativeCount).toBeGreaterThan(firstPoint.cumulativeCount);

    // Verify chronological order
    for (let i = 1; i < progressData.timeline.length; i++) {
      expect(progressData.timeline[i].date >= progressData.timeline[i - 1].date).toBe(true);
      expect(
        progressData.timeline[i].cumulativeCount >= progressData.timeline[i - 1].cumulativeCount,
      ).toBe(true);
    }
  });

  test("skips empty-Hebrew stub comments when indexing a page", () => {
    const amudFixture: Amud = {
      id: "Eruvin 44a",
      sections: [
        {
          ref: "Eruvin 44a:1",
          he: "גמרא",
          en: "Gemara",
          commentary: {
            Rashi: {
              comments: [
                {
                  ref: "Rashi on Eruvin 44a:1:1",
                  he: "ד\"ה א",
                  en: "",
                  sourceRef: "Rashi on Eruvin 44a:1:1",
                  sourceHeRef: "רש\"י",
                },
                {
                  ref: "Rashi on Eruvin 44a:1:2",
                  he: "",
                  en: "",
                  sourceRef: "Rashi on Eruvin 44a:1:2",
                  sourceHeRef: "רש\"י",
                },
              ],
            },
            Tosafot: {
              comments: [
                {
                  ref: "Tosafot on Eruvin 44a:1:1",
                  he: ["ד\"ה ב"],
                  en: "Translated by Sefaria",
                  sourceRef: "Tosafot on Eruvin 44a:1:1",
                  sourceHeRef: "תוספות",
                },
                {
                  ref: "Tosafot on Eruvin 44a:1:2",
                  he: [],
                  en: "",
                  sourceRef: "Tosafot on Eruvin 44a:1:2",
                  sourceHeRef: "תוספות",
                },
                {
                  ref: "Tosafot on Eruvin 44a:1:3",
                  he: ["   "],
                  en: "",
                  sourceRef: "Tosafot on Eruvin 44a:1:3",
                  sourceHeRef: "תוספות",
                },
              ],
            },
          },
        },
      ],
    };

    expect(extractPageCommentaryIndex(amudFixture)).toEqual({
      refs: ["Rashi on Eruvin 44a:1:1", "Tosafot on Eruvin 44a:1:1"],
      sefariaTranslatedRefs: ["Tosafot on Eruvin 44a:1:1"],
    });
  });

  test("counts Sefaria and AI translations without double-counting", () => {
    const pageIndex: PageCommentaryIndex = {
      refs: [
        "Rashi on Eruvin 44a:1:1",
        "Tosafot on Eruvin 44a:1:1",
        "Rashi on Eruvin 44a:2:1",
      ],
      sefariaTranslatedRefs: ["Tosafot on Eruvin 44a:1:1"],
    };
    const counts = countPageTranslations(pageIndex, {
      "Rashi on Eruvin 44a:1:1": {english: "English 1", status: "pending"},
      "Tosafot on Eruvin 44a:1:1": {english: "AI override", status: "pending"},
      "Rashi on Eruvin 44a:2:1": {hebrew: "Hebrew only"},
    });

    expect(counts).toEqual({
      totalComments: 3,
      translatedComments: 2,
    });
  });

  test("excludes empty-Hebrew Sefaria stubs on Eruvin 44a in commentary index", () => {
    const commentaryIndex = JSON.parse(
      readUtf8(RASHI_TOSAFOT_COMMENTS_PER_PAGE_PATH),
    ) as Record<string, PageCommentaryIndex>;
    const pageIndex = commentaryIndex["Eruvin 44a"];

    expect(pageIndex).toBeDefined();
    expect(pageIndex.refs).not.toContain("Tosafot on Eruvin 44a:1:2");
    expect(pageIndex.refs).not.toContain("Tosafot on Eruvin 44a:2:2");
    expect(pageIndex.refs).not.toContain("Tosafot on Eruvin 44a:2:3");
    expect(pageIndex.refs).not.toContain("Tosafot on Eruvin 44a:2:4");
    expect(pageIndex.refs).not.toContain("Rashi on Eruvin 44a:9:2");
    expect(pageIndex.refs).toHaveLength(25);

    const counts = countPageTranslations(pageIndex, aiEditsForPage("Eruvin 44a"));
    expect(counts).toEqual({
      totalComments: 25,
      translatedComments: 25,
    });
  });
});
