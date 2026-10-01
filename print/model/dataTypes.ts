// Shapes returned by the /api/print/... endpoints (print/server/routes.ts).

export interface MikraotComment {
  ref: string;
  he: string;
  en: string;
}

export interface MikraotCommentary {
  id: string;
  // verses[i] holds the comments on verse i + 1.
  verses: MikraotComment[][];
  heVersion?: string;
  enVersion?: string;
  error?: string;
}

export interface MikraotVerse {
  he: string;
  en: string;
  // A parasha break after this verse: petucha (open, new line) or setuma (closed, a gap).
  breakAfter?: "peh" | "samekh";
}

export interface MikraotChapter {
  book: string;
  bookHebrew: string;
  chapter: number;
  verses: MikraotVerse[];
  heVersion: string;
  enVersion: string;
  commentaries: Record<string, MikraotCommentary>;
}

export interface SiddurSegmentData {
  ref: string;
  he: string;
  en: string;
  // Starts a new paragraph (from the curated API's sugya/section markers or Sefaria segments).
  paragraphStart?: boolean;
  // Commentary from the data source, keyed by commentary englishName.
  commentary?: Record<string, {he: string; en: string}[]>;
}

export interface SiddurSectionData {
  id: string;
  title: string;
  titleHebrew: string;
  segments: SiddurSegmentData[];
}
