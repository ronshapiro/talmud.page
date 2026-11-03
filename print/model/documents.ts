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
  // Split segments into pieces at the source's own line breaks (e.g. Koren's sense lines).
  splitLines?: boolean;
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
  // Hebrew line height (and the line grid for English when lines are aligned).
  lineHeight: number;
  englishLineHeight: number;
  notesLineHeight: number;
  titleLineHeight: number;
  instructionColor: string;
  accentColor: string;
  // Set English on the Hebrew line pitch so side-by-side lines line up (always on for facing
  // pages).
  lineGrid?: boolean;
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
  // "facing": Hebrew and English on facing pages of each spread, rows aligned (Koren style).
  spread: "single" | "facing";
  // In facing mode, which page of the spread holds the Hebrew.
  facingHebrewSide: "left" | "right";
  // Print/PDF each spread as a single landscape page.
  printSpreads?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Mikraot Gedolot

export type Tier = 0 | 1 | 2;

// How a commentary's (or the verses') English is set relative to its Hebrew.
export type EnglishMode = "none" | "footnote" | "stacked" | "side-by-side" | "addendum";

export const ENGLISH_MODES: {id: EnglishMode; label: string}[] = [
  {id: "none", label: "No English"},
  {id: "footnote", label: "English as footnote"},
  {id: "stacked", label: "Hebrew above English"},
  {id: "side-by-side", label: "Side by side"},
  {id: "addendum", label: "English in the continuations"},
];

export interface CommentatorConfig {
  // A registry id (mikraotCommentators.ts) or "sefaria:<refPrefix>" for any other Sefaria text.
  id: string;
  // For Sefaria texts outside the registry: the chapter ref is `${refPrefix}${chapter}`.
  refPrefix?: string;
  englishName?: string;
  hebrewName?: string;
  tier: Tier;
  english: EnglishMode;
  // Side by side: let the English wrap around the Hebrew (floated, as in the web app's
  // translationWrapped) instead of keeping to its own column.
  wrap?: boolean;
  // Comments longer than this many lines continue in the addenda at the end (unset = the
  // document's maxCommentLines).
  maxLines?: number;
  // Typography overrides; unset = the document's general commentary typography.
  font?: string;
  sizePt?: number;
  englishFont?: string;
  englishSizePt?: number;
  /** @deprecated Replaced by `english`; read only when migrating old documents. */
  showEnglish?: boolean;
}

export interface CommentOverride {
  hidden?: boolean;
  tier?: Tier;
  // Turn the English of this one comment on (in the commentator's mode, or as a footnote) or off.
  showEnglish?: boolean;
  // Line limit for this comment (0 = no limit); overrides the commentator's and the document's.
  maxLines?: number;
}

// Styling of a verse/chapter marker, e.g. the red verse numbers.
export interface LabelStyle {
  font?: string;
  // Relative to the surrounding text.
  scale: number;
  color: string;
  bold: boolean;
  superscript: boolean;
  prefix: string;
  suffix: string;
  numerals: "hebrew" | "arabic";
}

export interface MikraotTypography {
  mainFont: string;
  commentaryFont: string;
  notesFont: string;
  // General English font/size for stacked and side-by-side commentary English.
  englishFont: string;
  englishSizePt: number;
  mainSizePt: number;
  // General commentary sizes by tier.
  tier1SizePt: number;
  tier2SizePt: number;
  targumSizePt: number;
  notesSizePt: number;
  // Commentary line height.
  lineHeight: number;
  // Line heights of the other element types.
  mainLineHeight: number;
  targumLineHeight: number;
  // Translation set with the verses. With side-by-side placement and alignMainLines, both sides
  // use the larger of the Hebrew and English line pitches so the lines line up.
  mainEnglishLineHeight: number;
  alignMainLines: boolean;
  commentaryEnglishLineHeight: number;
  notesLineHeight: number;
  headingLineHeight: number;
  showTrope: boolean;
  verseLabel: LabelStyle;
  commentLabel: LabelStyle;
  chapterLabel: LabelStyle;
}

export type MainEnglishMode = "notes" | "side-by-side" | "stacked" | "none";

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
  // If a page that fits its verses' commentary completely would be less full than this, take one
  // more verse and continue its commentary on the next page instead.
  minPageFill: number;
  showTargum: boolean;
  // Where the verses' translation goes.
  mainEnglish: MainEnglishMode;
  columnRules: boolean;
  // Comments longer than this many lines are cut, continuing in an addenda section at the end of
  // the book. 0 = no limit.
  maxCommentLines: number;
  // Mark a comment whose English is set in the continuations with a pointer to it ("ד׳·20").
  continuationTranslationRefs: boolean;
  // The heading of each continuation: a template (see CONTINUATION_HEADING_FORMATS).
  continuationHeading: string;
  /** @deprecated Replaced by mainEnglish. */
  showVerseTranslation?: boolean;
}

/**
 * Preset templates for continuation headings. Placeholders: {n} the continuation's number, {name}
 * the commentator, {ref} "פרק א׳ פסוק י״א" (just the verse within a single chapter), {cv} "א:י״א",
 * {page} the page the comment starts on. Parentheses are set in a lighter style; a parenthesis
 * containing {page} is dropped when the page isn't known.
 */
export const CONTINUATION_HEADING_FORMATS: {template: string; label: string}[] = [
  {template: "{n}. {name}, {ref} (מעמ׳ {page})", label: "ע״ד. העמק דבר, פרק א׳ פסוק י״א (מעמ׳ 5)"},
  {template: "[{n}] {name} - {cv}", label: "[ע״ד] העמק דבר - א:י״א"},
  {template: "[{n}] {name} - {cv} (עמ׳ {page})", label: "[ע״ד] העמק דבר - א:י״א (עמ׳ 5)"},
  {template: "{n}. {name} ({cv})", label: "ע״ד. העמק דבר (א:י״א)"},
  {template: "{cv} {name} [{n}]", label: "א:י״א העמק דבר [ע״ד]"},
];

// What a section covers: a range of chapters, or a weekly Torah portion (parshiyot.ts id).
export type SectionRange =
  | {kind: "chapters"; startChapter: number; endChapter: number}
  | {kind: "parsha"; parsha: string};

/**
 * A rendering of a range of the book. A document can render the same range several times, e.g. a
 * parsha with only Rashi for reading through, then again with more commentaries for study.
 */
export interface MikraotSection {
  id: string;
  // A heading set at the start of the section (optional).
  title?: string;
  range: SectionRange;
  // Repeated renderings may leave out the verses themselves.
  showMainText: boolean;
  commentators: CommentatorConfig[];
  // Overrides layout.mainEnglish for this section.
  mainEnglish?: MainEnglishMode;
}

// Which English labels are printed (all are dropped in Hebrew-only mode).
export interface EnglishLabels {
  runningHead: boolean;
  chapterHeadings: boolean;
  sectionTitles: boolean;
  continuations: boolean;
  notes: boolean;
}

export interface MikraotDocument extends BaseDocument {
  kind: "mikraot";
  book: string;
  sections: MikraotSection[];
  // No English anywhere, in the output or the editor's options.
  hebrewOnly: boolean;
  englishLabels: EnglishLabels;
  // Label the aliyot in the text (Torah books).
  showAliyot: boolean;
  // Sefaria versionTitle of the verse translation; unset = Sefaria's default.
  translationVersion?: string;
  commentOverrides: Record<string, CommentOverride>;
  typography: MikraotTypography;
  layout: MikraotLayout;
  /** @deprecated Moved into sections; read only when migrating old documents. */
  startChapter?: number;
  /** @deprecated */
  endChapter?: number;
  /** @deprecated */
  commentators?: CommentatorConfig[];
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
    edition: "koren",
    sections: [
      "koren:Weekdays, Blessings of the Shema",
      "koren:Shabbat, Kabbalat Shabbat",
    ],
    typography: {
      hebrewFont: "frank-ruehl-clm",
      englishFont: "eb-garamond",
      hebrewSizePt: 14,
      englishSizePt: 10.5,
      lineHeight: 1.55,
      englishLineHeight: 1.42,
      notesLineHeight: 1.32,
      titleLineHeight: 1.5,
      instructionColor: "#8a6d3b",
      accentColor: "#7a1f1f",
    },
    // Koren's text comes broken into sense lines: give each line its own row, aligned with its
    // translation, with a hanging indent for lines that wrap.
    defaults: {
      translation: "side-by-side",
      lineMode: "lines",
      splitLines: true,
      indent: 1.5,
      align: "start",
      englishAlign: "start",
    },
    sectionOverrides: {},
    paragraphOverrides: {},
    segmentOverrides: {},
    commentary: {},
    showCommentary: ["Koren Sacks Commentary"],
    sectionPageBreaks: true,
    spread: "single",
    facingHebrewSide: "left",
  };
}

export function defaultCommentatorConfigs(book: string): CommentatorConfig[] {
  return commentatorsForBook(book).map(x => ({
    id: x.id,
    tier: x.defaultTier,
    english: x.defaultShowEnglish ? "footnote" : "none",
  }));
}

export const DEFAULT_VERSE_LABEL: LabelStyle = {
  scale: 0.56, color: "#7a1f1f", bold: true, superscript: true, prefix: "", suffix: "", numerals: "hebrew",
};
export const DEFAULT_COMMENT_LABEL: LabelStyle = {
  scale: 0.92, color: "#7a1f1f", bold: true, superscript: false, prefix: "", suffix: "", numerals: "hebrew",
};
export const DEFAULT_CHAPTER_LABEL: LabelStyle = {
  scale: 0.82, color: "#7a1f1f", bold: false, superscript: false, prefix: "פרק ", suffix: "", numerals: "hebrew",
};

export function defaultSection(book: string, range?: SectionRange): MikraotSection {
  return {
    id: newId("section"),
    range: range ?? {kind: "chapters", startChapter: 1, endChapter: 1},
    showMainText: true,
    commentators: defaultCommentatorConfigs(book),
  };
}

export const DEFAULT_ENGLISH_LABELS: EnglishLabels = {
  runningHead: true,
  chapterHeadings: true,
  sectionTitles: true,
  continuations: true,
  notes: true,
};

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
    sections: [defaultSection(book)],
    hebrewOnly: false,
    englishLabels: DEFAULT_ENGLISH_LABELS,
    showAliyot: true,
    commentOverrides: {},
    typography: {
      mainFont: "keter-yg",
      commentaryFont: "noto-rashi",
      notesFont: "eb-garamond",
      englishFont: "eb-garamond",
      englishSizePt: 8.6,
      mainSizePt: 15,
      tier1SizePt: 9.6,
      tier2SizePt: 8.6,
      targumSizePt: 10,
      notesSizePt: 7.6,
      lineHeight: 1.45,
      mainLineHeight: 1.62,
      targumLineHeight: 1.5,
      mainEnglishLineHeight: 1.45,
      alignMainLines: true,
      commentaryEnglishLineHeight: 1.32,
      notesLineHeight: 1.3,
      headingLineHeight: 1.6,
      showTrope: true,
      verseLabel: DEFAULT_VERSE_LABEL,
      commentLabel: DEFAULT_COMMENT_LABEL,
      chapterLabel: DEFAULT_CHAPTER_LABEL,
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
      minPageFill: 0.88,
      showTargum: false,
      mainEnglish: "notes",
      columnRules: true,
      maxCommentLines: 0,
      continuationTranslationRefs: false,
      continuationHeading: CONTINUATION_HEADING_FORMATS[0].template,
    },
  };
}

function migrateCommentators(commentators: CommentatorConfig[]): CommentatorConfig[] {
  return commentators
    .filter(x => x.id.startsWith("sefaria:") || COMMENTATORS.some(c => c.id === x.id))
    .map(x => {
      const {showEnglish, ...rest} = x;
      if (rest.english !== undefined) return rest;
      return {...rest, english: showEnglish ? "footnote" : "none"};
    });
}

function migrateMikraot(doc: MikraotDocument, merged: any): void {
  if (!doc.sections) {
    // Before sections, a document was a single chapter range.
    merged.sections = [{
      id: newId("section"),
      range: {kind: "chapters", startChapter: doc.startChapter ?? 1, endChapter: doc.endChapter ?? 1},
      showMainText: true,
      commentators: migrateCommentators(doc.commentators ?? defaultCommentatorConfigs(doc.book)),
    }];
  } else {
    merged.sections = doc.sections.map(x => ({
      ...x,
      commentators: migrateCommentators(x.commentators),
    }));
  }
  delete merged.startChapter;
  delete merged.endChapter;
  delete merged.commentators;
  merged.englishLabels = {...DEFAULT_ENGLISH_LABELS, ...(doc.englishLabels ?? {})};
  if (doc.layout?.mainEnglish === undefined && doc.layout?.showVerseTranslation === false) {
    merged.layout.mainEnglish = "none";
  }
  delete merged.layout.showVerseTranslation;
}

/** Fills in fields added after a document was created. */
export function migrateDocument(doc: PrintDocument): PrintDocument {
  const defaults = doc.kind === "siddur" ? defaultSiddurDocument() : defaultMikraotDocument();
  const merged: any = {...defaults, ...doc};
  for (const key of ["typography", "layout", "defaults"]) {
    if ((defaults as any)[key]) merged[key] = {...(defaults as any)[key], ...(doc as any)[key]};
  }
  if (doc.kind === "mikraot") migrateMikraot(doc, merged);
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
