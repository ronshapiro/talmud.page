// Siddur source data + document overrides -> a flat list of render rows for the paginator. Pure
// (no DOM), so it can be unit tested.
//
// Hierarchy: section -> paragraph -> segment -> piece. Layout options are resolved from the most
// specific level that sets them (piece > segment > paragraph > section > document defaults).

import {SiddurSectionData, SiddurSegmentData} from "./dataTypes";
import {
  Align,
  HebrewBreaks,
  LayoutOptions,
  LineMode,
  SegmentOverride,
  SiddurDocument,
  TranslationMode,
} from "./documents";
import {
  Mark,
  Token,
  applyLineBreaks,
  applyStyleRanges,
  joinTokens,
  renderTokens,
  sliceTokens,
  tokenize,
  wordStarts,
} from "./richText";

export interface ResolvedOptions {
  translation: TranslationMode;
  lineMode: LineMode;
  align: Align;
  englishAlign: Align;
  hebrewBreaks: HebrewBreaks;
  splitLines: boolean;
  indent: number;
  spaceBefore?: number;
  pageBreakBefore: boolean;
  keepWithNext: boolean;
  hidden: boolean;
  scale: number;
  css: string;
}

export interface Piece {
  key: string; // `${ref}#${index}`
  ref: string;
  index: number;
  sectionId: string;
  paragraphKey: string;
  he: Token[];
  en: Token[];
  options: ResolvedOptions;
}

export interface SiddurNote {
  kind: "translation" | "commentary";
  // For commentary: the CommentaryType englishName.
  type?: string;
  marker?: string;
  html: string;
  pieceKey: string;
}

export interface SiddurRow {
  kind: "row";
  key: string;
  sectionId: string;
  paragraphKey: string;
  pieces: string[];
  translation: TranslationMode;
  options: ResolvedOptions;
  he: Token[];
  en: Token[];
  // First row of a paragraph.
  paragraphStart: boolean;
  notes: SiddurNote[];
}

export interface SiddurTitle {
  kind: "title";
  key: string;
  sectionId: string;
  he: string;
  en: string;
  pageBreakBefore: boolean;
}

export type SiddurUnit = SiddurRow | SiddurTitle;

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;$/, "");
}

function startsWithRubric(tokens: Token[]): boolean {
  const first = tokens.find(x => x.kind === "word");
  return Boolean(first && first.marks.some(x => x.tag === "small" || x.tag === "i"));
}

function renderPlain(tokens: Token[]): string {
  // Footnotes are rendered inside the notes area: keep inline markup, drop the piece marks.
  return renderTokens(tokens
    .filter(x => x.kind === "word")
    .map(x => ({...x, marks: x.marks.filter(m => !m.attrs.includes("sd-piece"))})));
}

/**
 * The commentary of `type` for a segment: the document's own text if it has one (an empty string
 * suppresses the source's), otherwise the source's.
 */
export function effectiveCommentary(
  doc: SiddurDocument,
  segment: SiddurSegmentData | undefined,
  ref: string,
  type: string,
): string {
  const own = (doc.commentary[ref] ?? []).find(x => x.type === type);
  if (own) return own.html;
  const source = segment?.commentary?.[type]?.[0];
  return source ? (source.en || source.he) : "";
}

export function paragraphKey(sectionId: string, index: number): string {
  return `${sectionId}#${index}`;
}

export function pieceKey(ref: string, index: number): string {
  return `${ref}#${index}`;
}

const LAYOUT_KEYS: (keyof LayoutOptions)[] = [
  "translation",
  "lineMode",
  "align",
  "englishAlign",
  "hebrewBreaks",
  "splitLines",
  "indent",
  "spaceBefore",
  "pageBreakBefore",
  "keepWithNext",
  "hidden",
  "scale",
  "css",
];

export function layoutFields(options: LayoutOptions | undefined): LayoutOptions {
  const result: LayoutOptions = {};
  if (!options) return result;
  for (const key of LAYOUT_KEYS) {
    if (options[key] !== undefined) (result as any)[key] = options[key];
  }
  return result;
}

export function resolveOptions(levels: (LayoutOptions | undefined)[]): ResolvedOptions {
  const merged: LayoutOptions = {};
  // Later levels are more specific.
  for (const level of levels) Object.assign(merged, layoutFields(level));
  return {
    translation: merged.translation ?? "side-by-side",
    lineMode: merged.lineMode ?? "prose",
    align: merged.align ?? "justify",
    englishAlign: merged.englishAlign ?? merged.align ?? "justify",
    hebrewBreaks: merged.hebrewBreaks ?? "none",
    splitLines: merged.splitLines ?? false,
    indent: merged.indent ?? 0,
    spaceBefore: merged.spaceBefore,
    pageBreakBefore: merged.pageBreakBefore ?? false,
    keepWithNext: merged.keepWithNext ?? false,
    hidden: merged.hidden ?? false,
    scale: merged.scale ?? 1,
    css: merged.css ?? "",
  };
}

/** Groups a section's segments into paragraphs (index lists). */
export function paragraphsOf(section: SiddurSectionData): SiddurSegmentData[][] {
  const paragraphs: SiddurSegmentData[][] = [];
  section.segments.forEach((segment, i) => {
    if (i === 0 || segment.paragraphStart || paragraphs.length === 0) paragraphs.push([]);
    paragraphs[paragraphs.length - 1].push(segment);
  });
  return paragraphs;
}

/** Snaps an index to the nearest word start. */
function snapToWord(tokens: Token[], index: number): number {
  const starts = wordStarts(tokens);
  let best = starts[0] ?? 0;
  for (const start of starts) {
    if (Math.abs(start - index) < Math.abs(best - index)) best = start;
  }
  return best;
}

/** Split points just after each line break (so the break is trimmed from the next piece). */
function lineBreakSplits(tokens: Token[]): number[] {
  const points: number[] = [];
  tokens.forEach((token, i) => {
    if (token.kind === "br" && i > 0 && i + 1 < tokens.length) points.push(i + 1);
  });
  return points;
}

export interface SegmentSplits {
  he: number[];
  en: number[];
}

/**
 * Where a segment is split into pieces, in each language. Manual splits (override.splitHe, with
 * optional explicit English counterparts) are combined with the source's line breaks when
 * `splitLines` is on; English line breaks are paired with Hebrew ones when their counts match.
 * English points without an explicit counterpart are placed proportionally and snapped to a word.
 */
export function segmentSplits(
  override: SegmentOverride,
  he: Token[],
  en: Token[],
  splitLines: boolean,
): SegmentSplits {
  // Hebrew split point -> explicit English split point, if any.
  const pairs = new Map<number, number | undefined>();
  (override.splitHe ?? []).forEach((point, i) => {
    pairs.set(point, override.splitEn?.[i] ?? undefined);
  });
  if (splitLines) {
    const heLines = lineBreakSplits(he);
    const enLines = lineBreakSplits(en);
    heLines.forEach((point, i) => {
      if (!pairs.has(point)) {
        pairs.set(point, heLines.length === enLines.length ? enLines[i] : undefined);
      }
    });
  }
  const heSplits = Array.from(pairs.keys())
    .filter(x => x > 0 && x < he.length)
    .sort((a, b) => a - b);
  // When line counts differ, prefer the English's own line boundaries to splitting mid-line.
  const enLineStarts = splitLines ? lineBreakSplits(en) : [];
  let last = 0;
  const enSplits = heSplits.map(point => {
    let english = pairs.get(point);
    if (english === undefined) {
      const estimate = Math.round((point / Math.max(1, he.length)) * en.length);
      english = en.length === 0 ? 0 : snapToWord(en, estimate);
      if (enLineStarts.length > 0) {
        english = enLineStarts.reduce((best, x) => (
          Math.abs(x - estimate) < Math.abs(best - estimate) ? x : best));
      }
    }
    last = Math.max(last, Math.min(en.length, english));
    return last;
  });
  return {he: heSplits, en: enSplits};
}

function shiftedBreaks(breaks: number[] | undefined, start: number, end: number): number[] {
  return (breaks ?? []).filter(x => x > start && x < end).map(x => x - start);
}

const SENTENCE_END = /[!.:;?׃]$/;
const CLAUSE_END = /[!,.:;?׃]$/;

/** Indices (before which to break) for automatic Hebrew line breaks at punctuation. */
export function automaticBreaks(tokens: Token[], mode: HebrewBreaks): number[] {
  if (mode === "none") return [];
  const pattern = mode === "clause" ? CLAUSE_END : SENTENCE_END;
  const breaks: number[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (token.kind === "word" && token.spaceAfter && pattern.test(stripTags(token.html))) {
      breaks.push(i + 1);
    }
  }
  return breaks;
}

export function pieceMark(key: string): Mark {
  return {tag: "span", attrs: ` class="sd-piece" data-k="${key.replace(/"/g, "&quot;")}"`};
}

function wrapPiece(tokens: Token[], key: string): Token[] {
  const mark = pieceMark(key);
  return tokens.map(x => ({...x, marks: [mark, ...x.marks]}));
}

/** Splits a segment into pieces, applying the segment's overrides. */
export function segmentPieces(
  doc: SiddurDocument,
  sectionId: string,
  paragraph: string,
  segment: SiddurSegmentData,
  levels: (LayoutOptions | undefined)[],
): Piece[] {
  const override = doc.segmentOverrides[segment.ref] ?? {};
  let he = tokenize(override.heOverride ?? segment.he);
  let en = tokenize(override.enOverride ?? segment.en);
  he = applyStyleRanges(he, override.stylesHe ?? []);
  en = applyStyleRanges(en, override.stylesEn ?? []);

  const segmentOptions = resolveOptions([...levels, layoutFields(override)]);
  const splits = segmentSplits(override, he, en, segmentOptions.splitLines);
  const heBounds = [0, ...splits.he, he.length];
  const enBounds = [0, ...splits.en, en.length];
  const hePieces = sliceTokens(he, splits.he);
  const enPieces = sliceTokens(en, splits.en);

  return hePieces.map((heTokens, i) => {
    const options = resolveOptions([...levels, layoutFields(override), override.pieces?.[i]]);
    const auto = automaticBreaks(heTokens, options.hebrewBreaks);
    const manualHe = shiftedBreaks(override.breaksHe, heBounds[i], heBounds[i + 1]);
    const manualEn = shiftedBreaks(override.breaksEn, enBounds[i], enBounds[i + 1]);
    const key = pieceKey(segment.ref, i);
    return {
      key,
      ref: segment.ref,
      index: i,
      sectionId,
      paragraphKey: paragraph,
      he: wrapPiece(applyLineBreaks(heTokens, Array.from(new Set([...auto, ...manualHe]))), key),
      en: wrapPiece(applyLineBreaks(enPieces[i] ?? [], manualEn), key),
      options,
    };
  });
}

function sameRowStyle(a: ResolvedOptions, b: ResolvedOptions): boolean {
  return a.translation === b.translation
    && a.align === b.align
    && a.englishAlign === b.englishAlign
    && a.indent === b.indent
    && a.scale === b.scale
    && a.css === b.css
    && a.hebrewBreaks === b.hebrewBreaks;
}

export interface BuildResult {
  units: SiddurUnit[];
  pieces: Map<string, Piece>;
}

export function buildSiddurUnits(
  doc: SiddurDocument,
  sections: Map<string, SiddurSectionData>,
): BuildResult {
  const units: SiddurUnit[] = [];
  const pieces = new Map<string, Piece>();

  doc.sections.forEach((sectionId, sectionIndex) => {
    const section = sections.get(sectionId);
    if (!section) return;
    const sectionOptions = doc.sectionOverrides[sectionId];
    if (sectionOptions?.hidden) return;

    units.push({
      kind: "title",
      key: `title:${sectionId}`,
      sectionId,
      he: section.titleHebrew,
      en: section.title,
      pageBreakBefore: sectionIndex > 0
        && (sectionOptions?.pageBreakBefore ?? doc.sectionPageBreaks),
    });

    let footnoteCounter = 0;
    const segmentsByRef = new Map(section.segments.map(x => [x.ref, x]));
    paragraphsOf(section).forEach((segments, paragraphIndex) => {
      const pKey = paragraphKey(sectionId, paragraphIndex);
      const levels = [doc.defaults, sectionOptions, doc.paragraphOverrides[pKey]];
      const paragraphPieces = segments.flatMap(
        segment => segmentPieces(doc, sectionId, pKey, segment, levels));
      paragraphPieces.forEach(x => pieces.set(x.key, x));
      const visible = paragraphPieces.filter(x => !x.options.hidden);

      let current: SiddurRow | undefined;
      const flush = () => {
        if (current) units.push(current);
        current = undefined;
      };
      for (const piece of visible) {
        const {options} = piece;
        const startsNewRow = !current
          || options.lineMode === "lines"
          // A rubric (instruction) at the start of a segment begins a new line.
          || (piece.index === 0 && startsWithRubric(piece.he))
          || options.pageBreakBefore
          || options.spaceBefore !== undefined
          || !sameRowStyle(current.options, options)
          || current.options.keepWithNext !== options.keepWithNext;
        if (startsNewRow) {
          flush();
          current = {
            kind: "row",
            key: `row:${piece.key}`,
            sectionId,
            paragraphKey: pKey,
            pieces: [],
            translation: options.translation,
            options,
            he: [],
            en: [],
            paragraphStart: units.length === 0
              || units[units.length - 1].kind === "title"
              || (units[units.length - 1] as SiddurRow).paragraphKey !== pKey,
            notes: [],
          };
        }
        const row = current!;
        row.pieces.push(piece.key);
        row.he = joinTokens([row.he, piece.he]);
        if (options.translation === "footnote") {
          if (piece.en.length > 0) {
            footnoteCounter++;
            const marker = String(footnoteCounter);
            row.he = [...row.he, {
              kind: "word",
              html: `<sup class="sd-fn">${marker}</sup>`,
              marks: piece.he[piece.he.length - 1]?.marks ?? [],
              spaceAfter: false,
            }];
            row.notes.push({kind: "translation", marker, html: renderPlain(piece.en), pieceKey: piece.key});
          }
        } else if (options.translation !== "hebrew-only") {
          row.en = joinTokens([row.en, piece.en]);
        }
        if (piece.index === 0) {
          for (const type of doc.showCommentary) {
            const html = effectiveCommentary(doc, segmentsByRef.get(piece.ref), piece.ref, type);
            if (html.trim()) {
              row.notes.push({kind: "commentary", type, html, pieceKey: piece.key});
            }
          }
        }
      }
      flush();
    });
  });

  return {units, pieces};
}
