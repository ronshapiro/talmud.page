export interface PageCommentaryIndex {
  refs: string[];
  sefariaTranslatedRefs?: string[];
}

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

export interface TranslationTimelinePoint {
  date: string;
  dailyCount: number;
  cumulativeCount: number;
}

export interface TranslationProgressData {
  summary: TranslationProgressSummary;
  masechtot: MasechetProgress[];
  timeline: TranslationTimelinePoint[];
}

export function roundPercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Returns whether a tractate has any Rashi or Tosafot comments to translate. Tractates with zero
 * comments (such as Tamid and Shekalim) are excluded from candidate and overall page totals.
 */
export function hasTranslatableComments(
  masechet: Pick<MasechetProgress, "totalComments">,
): boolean {
  return masechet.totalComments > 0;
}

/**
 * Aggregates overall dashboard totals across tractates that have Rashi or Tosafot commentary,
 * excluding tractates with zero Rashi/Tosafot comments from candidate and page counts.
 */
export function computeProgressSummary(
  masechtot: MasechetProgress[],
  updatedAt: string,
): TranslationProgressSummary {
  let totalPages = 0;
  let completePages = 0;
  let partialPages = 0;
  let notStartedPages = 0;
  let noCommentsPages = 0;
  let totalComments = 0;
  let translatedComments = 0;

  for (const masechet of masechtot) {
    if (!hasTranslatableComments(masechet)) {
      continue;
    }
    totalPages += masechet.totalPages;
    completePages += masechet.completePages;
    partialPages += masechet.partialPages;
    notStartedPages += masechet.notStartedPages;
    noCommentsPages += masechet.noCommentsPages;
    totalComments += masechet.totalComments;
    translatedComments += masechet.translatedComments;
  }

  return {
    totalPages,
    completePages,
    partialPages,
    notStartedPages,
    noCommentsPages,
    totalComments,
    translatedComments,
    percentCompletePages: roundPercentage(completePages, totalPages),
    percentTranslatedComments: roundPercentage(translatedComments, totalComments),
    updatedAt,
  };
}
