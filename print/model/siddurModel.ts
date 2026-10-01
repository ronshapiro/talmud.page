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
  splitTokens,
  tokenize,
  wordStarts,
} from "./richText";

export interface ResolvedOptions {
  translation: TranslationMode;
  lineMode: LineMode;
  align: Align;
  englishAlign: Align;
  hebrewBreaks: HebrewBreaks;
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

/**
 * English split points for each Hebrew split point. Explicit ones are used as given; missing ones
 * are placed proportionally (by token position) and snapped to a word start.
 */
export function englishSplits(override: SegmentOverride, heLength: number, en: Token[]): number[] {
  const heSplits = override.splitHe ?? [];
  return heSplits.map((heIndex, i) => {
    const explicit = override.splitEn?.[i];
    if (explicit !== undefined && explicit !== null) return explicit;
    if (en.length === 0) return 0;
    return snapToWord(en, Math.round((heIndex / Math.max(1, heLength)) * en.length));
  });
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

  const heSplits = override.splitHe ?? [];
  const enSplitPoints = englishSplits(override, he.length, en);
  const heBounds = [0, ...heSplits, he.length];
  const enBounds = [0, ...enSplitPoints, en.length];
  const hePieces = splitTokens(he, heSplits);
  const enPieces = splitTokens(en, enSplitPoints);

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
          for (const note of doc.commentary[piece.ref] ?? []) {
            if (doc.showCommentary.includes(note.type) && note.html.trim()) {
              row.notes.push({kind: "commentary", type: note.type, html: note.html, pieceKey: piece.key});
            }
          }
        }
      }
      flush();
    });
  });

  return {units, pieces};
}
