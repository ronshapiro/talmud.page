/* eslint-disable no-console */
import * as fs from "fs";
import {books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {aiEditsForPage} from "./ai_edits";
import {writeJson} from "../util/json_files";
import {readUtf8} from "../files";

export type PageProgressStatus = "complete" | "partial" | "not_started" | "no_comments";

export interface PageProgress {
  section: string;
  status: PageProgressStatus;
  totalComments: number;
  translatedComments: number;
}

export interface MasechetProgress {
  canonicalName: string;
  hebrewName: string;
  seder: string;
  sederHebrew: string;
  totalPages: number;
  completePages: number;
  partialPages: number;
  notStartedPages: number;
  noCommentsPages: number;
  totalComments: number;
  translatedComments: number;
  percentCompletePages: number;
  percentTranslatedComments: number;
  pages: PageProgress[];
}

export interface TranslationProgressSummary {
  totalPages: number;
  completePages: number;
  partialPages: number;
  notStartedPages: number;
  noCommentsPages: number;
  totalComments: number;
  translatedComments: number;
  percentCompletePages: number;
  percentTranslatedComments: number;
  updatedAt: string;
}

export interface TranslationProgressData {
  summary: TranslationProgressSummary;
  masechtot: MasechetProgress[];
}

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

function roundPercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computeTranslationProgress(): TranslationProgressData {
  const masechtotProgress: MasechetProgress[] = [];

  let overallTotalPages = 0;
  let overallCompletePages = 0;
  let overallPartialPages = 0;
  let overallNotStartedPages = 0;
  let overallNoCommentsPages = 0;
  let overallTotalComments = 0;
  let overallTranslatedComments = 0;

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
      overallTotalPages++;

      const pageRef = `${book.canonicalName} ${section}`;
      const outputFilePath = cachedOutputFilePath(book, section);

      let pageCommentCount = 0;
      let pageTranslatedCount = 0;

      if (fs.existsSync(outputFilePath)) {
        try {
          const amudData = JSON.parse(readUtf8(outputFilePath));
          const aiAdditions = aiEditsForPage(pageRef) ?? {};

          for (const segment of amudData.sections) {
            for (const commentator of ["Rashi", "Tosafot"]) {
              const commentaryComments = segment.commentary?.[commentator]?.comments ?? [];
              for (const comment of commentaryComments) {
                pageCommentCount++;
                const hasCachedTranslation = comment.en && comment.en.length > 0;
                const aiAddition = aiAdditions[comment.ref];
                const hasAiTranslation = (
                  aiAddition
                  && aiAddition.english
                  && aiAddition.english.length > 0
                );
                if (hasCachedTranslation || hasAiTranslation) {
                  pageTranslatedCount++;
                }
              }
            }
          }
        } catch {
          // Keep count as 0 if file reading or parsing fails
        }
      }

      masechetTotalComments += pageCommentCount;
      masechetTranslatedComments += pageTranslatedCount;
      overallTotalComments += pageCommentCount;
      overallTranslatedComments += pageTranslatedCount;

      let pageStatus: PageProgressStatus;
      if (pageCommentCount === 0) {
        pageStatus = "no_comments";
        masechetNoCommentsPages++;
        overallNoCommentsPages++;
      } else if (pageTranslatedCount === pageCommentCount) {
        pageStatus = "complete";
        masechetCompletePages++;
        overallCompletePages++;
      } else if (pageTranslatedCount > 0) {
        pageStatus = "partial";
        masechetPartialPages++;
        overallPartialPages++;
      } else {
        pageStatus = "not_started";
        masechetNotStartedPages++;
        overallNotStartedPages++;
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

  const summary: TranslationProgressSummary = {
    totalPages: overallTotalPages,
    completePages: overallCompletePages,
    partialPages: overallPartialPages,
    notStartedPages: overallNotStartedPages,
    noCommentsPages: overallNoCommentsPages,
    totalComments: overallTotalComments,
    translatedComments: overallTranslatedComments,
    percentCompletePages: roundPercentage(overallCompletePages, overallTotalPages),
    percentTranslatedComments: roundPercentage(overallTranslatedComments, overallTotalComments),
    updatedAt: new Date().toISOString(),
  };

  return {
    summary,
    masechtot: masechtotProgress,
  };
}

let cachedProgressData: TranslationProgressData | undefined;

export function getTranslationProgress(): TranslationProgressData {
  if (cachedProgressData) {
    return cachedProgressData;
  }

  if (fs.existsSync(TRANSLATION_PROGRESS_PATH)) {
    try {
      cachedProgressData = (
        JSON.parse(readUtf8(TRANSLATION_PROGRESS_PATH)) as TranslationProgressData
      );
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
