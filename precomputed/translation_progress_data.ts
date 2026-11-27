/* eslint-disable no-console */
import * as fs from "fs";
import {Amud} from "../apiTypes";
import {Book, books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {toFlatArray} from "../sefariaTextType";
import {aiEditsForPage, Edit} from "./ai_edits";
import {writeJson} from "../util/json_files";
import {readUtf8} from "../files";
import {
  computeProgressSummary,
  MasechetProgress,
  PageCommentaryIndex,
  PageProgress,
  PageProgressStatus,
  roundPercentage,
  TranslationProgressData,
  TranslationTimelinePoint,
} from "./translation_progress_summary";

export {
  computeProgressSummary,
  computeSevenDayRollingPace,
  hasTranslatableComments,
  MasechetProgress,
  PageCommentaryIndex,
  PageProgress,
  PageProgressStatus,
  roundPercentage,
  TranslationProgressData,
  TranslationProgressSummary,
  TranslationTimelinePoint,
} from "./translation_progress_summary";

export const SEDER_ORDER: Record<string, {seder: string; sederHebrew: string}> = {
  Berakhot: {seder: "Zeraim", sederHebrew: "זרעים"},

  Shabbat: {seder: "Moed", sederHebrew: "מועד"},
  Eruvin: {seder: "Moed", sederHebrew: "מועד"},
  Pesachim: {seder: "Moed", sederHebrew: "מועד"},
  Shekalim: {seder: "Moed", sederHebrew: "מועד"},
  Yoma: {seder: "Moed", sederHebrew: "מועד"},
  Sukkah: {seder: "Moed", sederHebrew: "מועד"},
  Beitzah: {seder: "Moed", sederHebrew: "מועד"},
  "Rosh Hashanah": {seder: "Moed", sederHebrew: "מועד"},
  Taanit: {seder: "Moed", sederHebrew: "מועד"},
  Megillah: {seder: "Moed", sederHebrew: "מועד"},
  "Moed Katan": {seder: "Moed", sederHebrew: "מועד"},
  Chagigah: {seder: "Moed", sederHebrew: "מועד"},

  Yevamot: {seder: "Nashim", sederHebrew: "נשים"},
  Ketubot: {seder: "Nashim", sederHebrew: "נשים"},
  Nedarim: {seder: "Nashim", sederHebrew: "נשים"},
  Nazir: {seder: "Nashim", sederHebrew: "נשים"},
  Sotah: {seder: "Nashim", sederHebrew: "נשים"},
  Gittin: {seder: "Nashim", sederHebrew: "נשים"},
  Kiddushin: {seder: "Nashim", sederHebrew: "נשים"},

  "Bava Kamma": {seder: "Nezikin", sederHebrew: "נזיקין"},
  "Bava Metzia": {seder: "Nezikin", sederHebrew: "נזיקין"},
  "Bava Batra": {seder: "Nezikin", sederHebrew: "נזיקין"},
  Sanhedrin: {seder: "Nezikin", sederHebrew: "נזיקין"},
  Makkot: {seder: "Nezikin", sederHebrew: "נזיקין"},
  Shevuot: {seder: "Nezikin", sederHebrew: "נזיקין"},
  "Avodah Zarah": {seder: "Nezikin", sederHebrew: "נזיקין"},
  Horayot: {seder: "Nezikin", sederHebrew: "נזיקין"},

  Zevachim: {seder: "Kodashim", sederHebrew: "קדשים"},
  Menachot: {seder: "Kodashim", sederHebrew: "קדשים"},
  Chullin: {seder: "Kodashim", sederHebrew: "קדשים"},
  Bekhorot: {seder: "Kodashim", sederHebrew: "קדשים"},
  Arakhin: {seder: "Kodashim", sederHebrew: "קדשים"},
  Temurah: {seder: "Kodashim", sederHebrew: "קדשים"},
  Keritot: {seder: "Kodashim", sederHebrew: "קדשים"},
  Meilah: {seder: "Kodashim", sederHebrew: "קדשים"},
  Tamid: {seder: "Kodashim", sederHebrew: "קדשים"},

  Niddah: {seder: "Tahorot", sederHebrew: "טהרות"},
};

export const TALMUD_TRACTATE_NAMES: string[] = Object.keys(SEDER_ORDER);

export const TRANSLATION_PROGRESS_PATH = "precomputed/translation_progress.json";

export function computeTranslationTimeline(): TranslationTimelinePoint[] {
  const recordsDirectory = (
    "precomputed/rsi_state/generation_records/rashi_tosafot_translation"
  );
  const dailyCountsMap = new Map<string, number>();

  if (fs.existsSync(recordsDirectory)) {
    for (const tractateName of fs.readdirSync(recordsDirectory)) {
      const tractateDirectory = `${recordsDirectory}/${tractateName}`;
      if (!fs.statSync(tractateDirectory).isDirectory()) continue;

      for (const fileName of fs.readdirSync(tractateDirectory)) {
        if (!fileName.endsWith(".json")) continue;
        try {
          const fileContent = JSON.parse(readUtf8(`${tractateDirectory}/${fileName}`));
          for (const commentRef of Object.keys(fileContent)) {
            const record = fileContent[commentRef];
            if (record && record.generatedAt && !record.needsHumanAttention) {
              const dateString = record.generatedAt.slice(0, 10);
              const currentCount = dailyCountsMap.get(dateString) ?? 0;
              dailyCountsMap.set(dateString, currentCount + 1);
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  // Baseline seed translations produced prior to automated generation records
  const seedTranslationCount = 1362;
  dailyCountsMap.set("2026-01-01", seedTranslationCount);

  const sortedDates = Array.from(dailyCountsMap.keys()).sort();
  let cumulativeCount = 0;
  const timeline: TranslationTimelinePoint[] = [];

  for (const date of sortedDates) {
    const dailyCount = dailyCountsMap.get(date) ?? 0;
    cumulativeCount += dailyCount;
    timeline.push({
      date,
      dailyCount,
      cumulativeCount,
    });
  }

  return timeline;
}

export const RASHI_TOSAFOT_COMMENTS_PER_PAGE_PATH = (
  "precomputed/rashiTosafotCommentsPerPage.json"
);

/**
 * Extracts Rashi and Tosafot comment refs from a cached amud, skipping empty-Hebrew stub
 * comments (e.g. Sefaria placeholders where Community Translation was split across multiple
 * sub-refs while all Hebrew text lives in the first comment) so counts match the translator.
 */
export function extractPageCommentaryIndex(amudData: Amud): PageCommentaryIndex {
  const refs: string[] = [];
  const sefariaTranslatedRefs: string[] = [];

  for (const segment of amudData.sections) {
    for (const commentator of ["Rashi", "Tosafot"]) {
      const comments = segment.commentary?.[commentator]?.comments ?? [];
      for (const comment of comments) {
        if (!toFlatArray(comment.he).join(" ").trim()) {
          continue;
        }
        refs.push(comment.ref);
        if (toFlatArray(comment.en).join(" ").trim()) {
          sefariaTranslatedRefs.push(comment.ref);
        }
      }
    }
  }

  const pageIndex: PageCommentaryIndex = {refs};
  if (sefariaTranslatedRefs.length > 0) {
    pageIndex.sefariaTranslatedRefs = sefariaTranslatedRefs;
  }
  return pageIndex;
}

function resolvePageCommentaryIndex(
  book: Book,
  section: string,
  pageRef: string,
  commentaryIndex: Record<string, PageCommentaryIndex> | undefined,
): PageCommentaryIndex | undefined {
  if (commentaryIndex) {
    return commentaryIndex[pageRef];
  }
  const outputFilePath = cachedOutputFilePath(book, section);
  if (!fs.existsSync(outputFilePath)) {
    return undefined;
  }
  try {
    const amudData = JSON.parse(readUtf8(outputFilePath)) as Amud;
    return extractPageCommentaryIndex(amudData);
  } catch {
    return undefined;
  }
}

/** Counts total and translated Rashi/Tosafot comments for a single page index entry. */
export function countPageTranslations(
  pageEntry: PageCommentaryIndex | undefined,
  aiAdditions: Record<string, Edit> | undefined,
): {totalComments: number; translatedComments: number} {
  const pageRefs = pageEntry?.refs ?? [];
  const sefariaTranslatedSet = new Set(pageEntry?.sefariaTranslatedRefs ?? []);
  const edits = aiAdditions ?? {};
  let translatedComments = 0;

  for (const ref of pageRefs) {
    if (sefariaTranslatedSet.has(ref)) {
      translatedComments++;
    } else {
      const aiAddition = edits[ref];
      if (aiAddition && aiAddition.english && aiAddition.english.length > 0) {
        translatedComments++;
      }
    }
  }

  return {
    totalComments: pageRefs.length,
    translatedComments,
  };
}

export function computeTranslationProgress(): TranslationProgressData {
  const masechtotProgress: MasechetProgress[] = [];

  const commentaryIndex: Record<string, PageCommentaryIndex> | undefined = (
    fs.existsSync(RASHI_TOSAFOT_COMMENTS_PER_PAGE_PATH)
      ? JSON.parse(readUtf8(RASHI_TOSAFOT_COMMENTS_PER_PAGE_PATH))
      : undefined
  );

  for (const tractateName of TALMUD_TRACTATE_NAMES) {
    const book = books.byCanonicalName[tractateName];
    if (!book) {
      continue;
    }

    const sederInformation = SEDER_ORDER[tractateName] ?? {
      seder: "Unknown",
      sederHebrew: "לא ידוע",
    };

    let masechetTotalPages = 0;
    let masechetCompletePages = 0;
    let masechetPartialPages = 0;
    let masechetNotStartedPages = 0;
    let masechetNoCommentsPages = 0;
    let masechetTotalComments = 0;
    let masechetTranslatedComments = 0;

    const pageProgressList: PageProgress[] = [];

    for (const section of book.sections) {
      masechetTotalPages++;

      const pageRef = `${book.canonicalName} ${section}`;
      const pageEntry = resolvePageCommentaryIndex(book, section, pageRef, commentaryIndex);
      const {
        totalComments: pageCommentCount,
        translatedComments: pageTranslatedCount,
      } = countPageTranslations(pageEntry, aiEditsForPage(pageRef));

      masechetTotalComments += pageCommentCount;
      masechetTranslatedComments += pageTranslatedCount;

      let pageStatus: PageProgressStatus;
      if (pageCommentCount === 0) {
        pageStatus = "no_comments";
        masechetNoCommentsPages++;
      } else if (pageTranslatedCount === pageCommentCount) {
        pageStatus = "complete";
        masechetCompletePages++;
      } else if (pageTranslatedCount > 0) {
        pageStatus = "partial";
        masechetPartialPages++;
      } else {
        pageStatus = "not_started";
        masechetNotStartedPages++;
      }

      pageProgressList.push({
        section,
        status: pageStatus,
        totalComments: pageCommentCount,
        translatedComments: pageTranslatedCount,
      });
    }

    masechtotProgress.push({
      canonicalName: book.canonicalName,
      hebrewName: book.hebrewName,
      seder: sederInformation.seder,
      sederHebrew: sederInformation.sederHebrew,
      totalPages: masechetTotalPages,
      completePages: masechetCompletePages,
      partialPages: masechetPartialPages,
      notStartedPages: masechetNotStartedPages,
      noCommentsPages: masechetNoCommentsPages,
      totalComments: masechetTotalComments,
      translatedComments: masechetTranslatedComments,
      percentCompletePages: roundPercentage(masechetCompletePages, masechetTotalPages),
      percentTranslatedComments: roundPercentage(masechetTranslatedComments, masechetTotalComments),
      pages: pageProgressList,
    });
  }

  const summary = computeProgressSummary(masechtotProgress, new Date().toISOString());

  const timeline = computeTranslationTimeline();

  return {
    summary,
    masechtot: masechtotProgress,
    timeline,
  };
}

let cachedProgressData: TranslationProgressData | undefined;

export function getTranslationProgress(): TranslationProgressData {
  if (cachedProgressData) {
    return cachedProgressData;
  }

  if (fs.existsSync(TRANSLATION_PROGRESS_PATH)) {
    try {
      const loadedData = (
        JSON.parse(readUtf8(TRANSLATION_PROGRESS_PATH)) as TranslationProgressData
      );
      cachedProgressData = {
        ...loadedData,
        summary: computeProgressSummary(loadedData.masechtot, loadedData.summary.updatedAt),
      };
      return cachedProgressData;
    } catch {
      // Fall through to compute
    }
  }

  cachedProgressData = computeTranslationProgress();
  return cachedProgressData;
}

export function saveTranslationProgress(
  outputPath: string = TRANSLATION_PROGRESS_PATH,
): TranslationProgressData {
  const progressData = computeTranslationProgress();
  writeJson(outputPath, progressData);
  cachedProgressData = progressData;
  return progressData;
}

if (require.main === module) {
  console.log("Computing translation progress data...");
  const timerStart = Date.now();
  const progressResult = saveTranslationProgress();
  const elapsedSeconds = Math.round((Date.now() - timerStart) / 100) / 10;
  console.log(`Saved translation progress in ${elapsedSeconds}s to ${TRANSLATION_PROGRESS_PATH}`);
  const {summary} = progressResult;
  console.log(
    `Complete pages: ${summary.completePages} / ${summary.totalPages} `
    + `(${summary.percentCompletePages}%)`,
  );
  console.log(`Partial pages: ${summary.partialPages}`);
  console.log(`To go: ${summary.notStartedPages}`);
  console.log(
    `Comments translated: ${summary.translatedComments} / ${summary.totalComments} `
    + `(${summary.percentTranslatedComments}%)`,
  );
}
