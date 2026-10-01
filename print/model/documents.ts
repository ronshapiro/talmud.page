// Print documents: a named, versioned configuration of a siddur or a Mikraot Gedolot. Documents are
// stored in IndexedDB (print/store/documentStore.ts), selected with ?doc=<id>, and can be exported
// as JSON (which is also the input format of the offline PDF renderer).

import {Margins, PageSettings, pageSettingsFromPreset} from "./geometry";
import {StyleRange} from "./richText";
import {COMMENTATORS, commentatorsForBook} from "./mikraotCommentators";

export const SCHEMA_VERSION = 1;

export type DocumentKind = "siddur" | "mikraot";

interface BaseDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  page: PageSettings;
}

// ---------------------------------------------------------------------------------------------
// Siddur

export type TranslationMode = "side-by-side" | "stacked" | "hebrew-only" | "footnote";
export type LineMode = "prose" | "lines";
export type Align = "start" | "center" | "justify" | "end";
// Automatic Hebrew line breaks: after sentence punctuation (. : ; ׃) or also after commas.
export type HebrewBreaks = "none" | "sentence" | "clause";

export const TRANSLATION_MODES: {id: TranslationMode; label: string}[] = [
  {id: "side-by-side", label: "Side by side"},
  {id: "stacked", label: "Hebrew above English"},
  {id: "hebrew-only", label: "Hebrew only"},
  {id: "footnote", label: "English as footnote"},
];

/**
 * Layout options that can be set at every level of the hierarchy (document, section, paragraph,
 * segment, piece). Undefined = inherit.
 */
export interface LayoutOptions {
  translation?: TranslationMode;
  lineMode?: LineMode;
  align?: Align;
  englishAlign?: Align;
  hebrewBreaks?: HebrewBreaks;
  // Indentation of continuation lines in `lines` mode / whole block otherwise, in em.
  indent?: number;
  // Extra space above, in units of the Hebrew line height.
  spaceBefore?: number;
  pageBreakBefore?: boolean;
  keepWithNext?: boolean;
  hidden?: boolean;
  // Font size multiplier for the whole block.
  scale?: number;
  // Free-form CSS for the block (sanitized).
  css?: string;
}

export interface SegmentOverride extends LayoutOptions {
  // Token indices at which the segment is split into pieces. Hebrew and English are split
  // independently, so that each piece's translation can be matched by hand. Both lists must have
  // the same length; missing English split points are filled in proportionally.
  splitHe?: number[];
  // Parallel to splitHe; null = place proportionally.
  splitEn?: (number | null)[];
  // Forced line breaks (token indices, before the token) in the original token numbering.
  breaksHe?: number[];
  breaksEn?: number[];
  // Inline styles in the original token numbering.
  stylesHe?: StyleRange[];
  stylesEn?: StyleRange[];
  // Per-piece layout overrides, by piece index.
  pieces?: Record<number, LayoutOptions>;
  // Replacement text (HTML), when the source text needs a correction.
  heOverride?: string;
  enOverride?: string;
}

export interface SiddurCommentaryNote {
  // A CommentaryType englishName; "Koren Sacks Commentary" for the Koren Sacks Siddur commentary.
  type: string;
  html: string;
}

export interface SiddurTypography {
  hebrewFont: string;
  englishFont: string;
  hebrewSizePt: number;
  englishSizePt: number;
  lineHeight: number;
  instructionColor: string;
  accentColor: string;
}

export interface SiddurDocument extends BaseDocument {
  kind: "siddur";
  edition: string;
  sections: string[];
  typography: SiddurTypography;
  defaults: Required<Pick<LayoutOptions, "translation" | "lineMode" | "align">> & LayoutOptions;
  sectionOverrides: Record<string, LayoutOptions>;
  // Keyed by `${sectionId}#${paragraphIndex}`.
  paragraphOverrides: Record<string, LayoutOptions>;
  // Keyed by segment ref.
  segmentOverrides: Record<string, SegmentOverride>;
  // Keyed by segment ref.
  commentary: Record<string, SiddurCommentaryNote[]>;
  // Which commentary types to print.
  showCommentary: string[];
  // Each section starts on a new page.
  sectionPageBreaks: boolean;
}

// ---------------------------------------------------------------------------------------------
// Mikraot Gedolot

export type Tier = 0 | 1 | 2;

export interface CommentatorConfig {
  id: string;
  tier: Tier;
  showEnglish: boolean;
}

export interface CommentOverride {
  hidden?: boolean;
  tier?: Tier;
  showEnglish?: boolean;
}

export interface MikraotTypography {
  mainFont: string;
  commentaryFont: string;
  notesFont: string;
  mainSizePt: number;
  tier1SizePt: number;
  tier2SizePt: number;
  targumSizePt: number;
  notesSizePt: number;
  lineHeight: number;
  showTrope: boolean;
}

export interface MikraotLayout {
  tier1Columns: number;
  tier2Columns: number;
  notesColumns: number;
  columnGapPt: number;
  regionGapPt: number;
  // Upper bound on the English notes area, as a fraction of the text area.
  maxNotesFraction: number;
  // Upper bound on the main text area, as a fraction of the text area.
  maxMainFraction: number;
  // How many verses the main text may run ahead of a long commentary that is continued across
  // pages, before pages are given over to the commentary alone.
  maxCommentaryLag: number;
  showTargum: boolean;
  showVerseTranslation: boolean;
  columnRules: boolean;
}

export interface MikraotDocument extends BaseDocument {
  kind: "mikraot";
  book: string;
  startChapter: number;
  endChapter: number;
  commentators: CommentatorConfig[];
  commentOverrides: Record<string, CommentOverride>;
  typography: MikraotTypography;
  layout: MikraotLayout;
}

export type PrintDocument = SiddurDocument | MikraotDocument;

// ---------------------------------------------------------------------------------------------
// Defaults

export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

const SIDDUR_MARGINS: Margins = {top: 0.6, bottom: 0.65, inner: 0.7, outer: 0.55};
const MIKRAOT_MARGINS: Margins = {top: 0.55, bottom: 0.55, inner: 0.65, outer: 0.5};

export function defaultSiddurDocument(name = "My Siddur"): SiddurDocument {
  const now = Date.now();
  return {
    id: newId("siddur"),
    name,
    kind: "siddur",
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    page: pageSettingsFromPreset("digest", SIDDUR_MARGINS, "rtl"),
    edition: "ashkenaz",
    sections: [
      "SiddurAshkenaz/Birchot Kriat Shema",
      "Siddur Ashkenaz, Shabbat, Kabbalat Shabbat, Lekha Dodi",
    ],
    typography: {
      hebrewFont: "frank-ruehl-clm",
      englishFont: "eb-garamond",
      hebrewSizePt: 14,
      englishSizePt: 10.5,
      lineHeight: 1.55,
      instructionColor: "#8a6d3b",
      accentColor: "#7a1f1f",
    },
    defaults: {translation: "side-by-side", lineMode: "prose", align: "start", englishAlign: "start"},
    sectionOverrides: {},
    paragraphOverrides: {},
    segmentOverrides: {},
    commentary: {},
    showCommentary: ["Koren Sacks Commentary"],
    sectionPageBreaks: true,
  };
}

export function defaultCommentatorConfigs(book: string): CommentatorConfig[] {
  return commentatorsForBook(book).map(x => ({
    id: x.id,
    tier: x.defaultTier,
    showEnglish: x.defaultShowEnglish,
  }));
}

export function defaultMikraotDocument(name = "Mikraot Gedolot", book = "Genesis"): MikraotDocument {
  const now = Date.now();
  return {
    id: newId("mikraot"),
    name,
    kind: "mikraot",
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    page: pageSettingsFromPreset("crown-quarto", MIKRAOT_MARGINS, "rtl"),
    book,
    startChapter: 1,
    endChapter: 1,
    commentators: defaultCommentatorConfigs(book),
    commentOverrides: {},
    typography: {
      mainFont: "keter-yg",
      commentaryFont: "noto-rashi",
      notesFont: "eb-garamond",
      mainSizePt: 15,
      tier1SizePt: 9.6,
      tier2SizePt: 8.6,
      targumSizePt: 10,
      notesSizePt: 7.6,
      lineHeight: 1.45,
      showTrope: true,
    },
    layout: {
      tier1Columns: 2,
      tier2Columns: 3,
      notesColumns: 2,
      columnGapPt: 14,
      regionGapPt: 10,
      maxNotesFraction: 0.3,
      maxMainFraction: 0.45,
      maxCommentaryLag: 3,
      showTargum: false,
      showVerseTranslation: true,
      columnRules: true,
    },
  };
}

/** Fills in fields added after a document was created. */
export function migrateDocument(doc: PrintDocument): PrintDocument {
  const defaults = doc.kind === "siddur" ? defaultSiddurDocument() : defaultMikraotDocument();
  const merged: any = {...defaults, ...doc};
  for (const key of ["typography", "layout", "defaults"]) {
    if ((defaults as any)[key]) merged[key] = {...(defaults as any)[key], ...(doc as any)[key]};
  }
  if (doc.kind === "mikraot") {
    // Add newly registered commentators (off by default) so they show up in the settings.
    const known = new Set(doc.commentators.map(x => x.id));
    merged.commentators = [
      ...doc.commentators.filter(x => COMMENTATORS.some(c => c.id === x.id)),
      ...defaultCommentatorConfigs(doc.book)
        .filter(x => !known.has(x.id))
        .map(x => ({...x, tier: 0})),
    ];
  }
  merged.schemaVersion = SCHEMA_VERSION;
  return merged;
}

export function isPrintDocument(value: unknown): value is PrintDocument {
  const object = value as any;
  return Boolean(object)
    && typeof object === "object"
    && typeof object.id === "string"
    && (object.kind === "siddur" || object.kind === "mikraot");
}
