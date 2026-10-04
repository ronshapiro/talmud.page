// Mikraot Gedolot pagination. See print/README.md for the design.
//
// Page anatomy (top to bottom): running head · main text (+ optional targum and translation) ·
// primary commentary (columns, then side-by-side rows) · secondary commentary (likewise) ·
// English notes · folio.

import {intToHebrewNumeral} from "../../hebrew";
import {MikraotChapter} from "../model/dataTypes";
import {
  CommentatorConfig,
  EnglishMode,
  LabelStyle,
  MikraotDocument,
  Tier,
} from "../model/documents";
import {fontFamily, mixedFontFamily} from "../model/fonts";
import {pageBox} from "../model/geometry";
import {COMMENTATORS_BY_ID, resolveCommentator} from "../model/mikraotCommentators";
import {tokenize} from "../model/richText";
import {
  BlockSpec,
  MeasuredBlock,
  blockInnerHtml,
  measureBlocks,
  measureHtmlHeight,
  setMeasurementContext,
} from "./measure";
import {
  ColumnsResult,
  FlowItem,
  PAIR_START,
  PairItem,
  PairsResult,
  START,
  cursorDone,
  fillColumns,
  fillColumnsBalanced,
  fillPairs,
  pairsDone,
  rebaseItem,
  rebasePair,
} from "./packing";

const PT = 96 / 72;

type TierNumber = 1 | 2;

interface CommentEntry {
  ref: string;
  commentator: string;
  tier: TierNumber;
  verseIndex: number;
  english: EnglishMode;
  // Absent for English-only commentaries.
  he?: MeasuredBlock;
  // Stacked: English below the Hebrew in the same column. Side-by-side: the English lane.
  en?: MeasuredBlock;
  // Footnote mode.
  note?: MeasuredBlock;
  // Side by side with wrapping: one block of English flowing around the floated Hebrew.
  wrapped?: MeasuredBlock;
}

export interface MgItemData {
  kind: "chead" | "comment" | "comment-en" | "note-head" | "note" | "translation";
  measured: MeasuredBlock;
  // Number of lines of `measured` consumed on earlier pages (for continued comments).
  lineOffset: number;
  commentator?: string;
  entry?: CommentEntry;
}

interface MgPairData {
  kind: "chead" | "comment";
  measured: (MeasuredBlock | undefined)[];
  lineOffsets: number[];
  commentator: string;
  entry?: CommentEntry;
}

type Item = FlowItem<MgItemData>;
type Pair = PairItem<MgPairData>;

interface GlobalVerse {
  chapter: number;
  verse: number;
  he: string;
  en: string;
  targum?: string;
  breakAfter?: "peh" | "samekh";
}

export interface RenderedFragment {
  key: string;
  // The comment this fragment belongs to (comments and their English), for selection.
  ref?: string;
  lang?: string;
  className: string;
  style?: string;
  dir: "rtl" | "ltr";
  html: string;
  spaceBefore: number;
  height: number;
  // Downward shift aligning a side-by-side lane's baseline with its partner's.
  offset?: number;
}

export interface PairRowLayout {
  key: string;
  spaceBefore: number;
  height: number;
  // [hebrew, english]; a single lane (heading) spans the row.
  lanes: (RenderedFragment | undefined)[];
  span: boolean;
}

export type RegionKind = "tier-1" | "tier-1-pairs" | "tier-2" | "tier-2-pairs" | "notes";

export interface RegionLayout {
  kind: RegionKind;
  columnCount: number;
  columnWidth: number;
  height: number;
  columns: RenderedFragment[][];
  // For pair regions.
  rows?: PairRowLayout[];
}

export interface MgPage {
  index: number;
  // A section title set above the regions (the addenda).
  titleHtml?: string;
  titleHeight?: number;
  headerHebrew: string;
  headerEnglish: string;
  mainHtml?: string;
  targumHtml?: string;
  englishHtml?: string;
  mainHeight: number;
  regions: RegionLayout[];
  verseRange?: [string, string];
}

export interface MikraotLayout {
  pages: MgPage[];
  cssVars: string;
  geometry: {
    widthPx: number;
    heightPx: number;
    contentWidth: number;
    contentHeight: number;
    headerHeight: number;
    footerHeight: number;
    headerGap: number;
    footerGap: number;
    regionGap: number;
    notesRuleHeight: number;
    mainWidth: number;
    targumWidth: number;
    englishWidth: number;
    // How the verses' translation sits in the main area.
    mainEnglish: "beside" | "below" | "none";
    stackGap: number;
    pairHebrewWidth: number;
    pairEnglishWidth: number;
    columnGap: number;
  };
  marginsFor: (pageIndex: number) => {top: number; bottom: number; left: number; right: number};
  stats: {verses: number; comments: number; notes: number; millis: number};
}

export function mikraotCssVars(doc: MikraotDocument): string {
  const t = doc.typography;
  return [
    `--main-font: ${fontFamily(t.mainFont)}`,
    `--commentary-font: ${fontFamily(t.commentaryFont)}`,
    `--notes-font: ${mixedFontFamily(t.notesFont, t.mainFont)}`,
    `--english-font: ${mixedFontFamily(t.englishFont, t.mainFont)}`,
    `--english-size: ${t.englishSizePt}pt`,
    `--main-size: ${t.mainSizePt}pt`,
    `--tier1-size: ${t.tier1SizePt}pt`,
    `--tier2-size: ${t.tier2SizePt}pt`,
    `--targum-size: ${t.targumSizePt}pt`,
    `--notes-size: ${t.notesSizePt}pt`,
    `--lh: ${t.lineHeight}`,
    `--col-gap: ${doc.layout.columnGapPt}pt`,
  ].join("; ");
}

const TROPE_RE = /[֑-֯׀]/g;

function columnWidth(total: number, count: number, gap: number): number {
  return (total - (count - 1) * gap) / count;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A verse or chapter marker, styled by the document's LabelStyle. */
export function labelHtml(style: LabelStyle, number: number, className: string): string {
  const numeral = style.numerals === "arabic" ? String(number) : intToHebrewNumeral(number);
  const css = [
    style.font ? `font-family: ${fontFamily(style.font)}` : "",
    `font-size: ${style.scale}em`,
    `color: ${style.color}`,
    `font-weight: ${style.bold ? 700 : 400}`,
    style.superscript ? "vertical-align: 0.35em; line-height: 0" : "vertical-align: baseline",
  ].filter(x => x).join("; ");
  const text = escapeHtml(`${style.prefix}${numeral}${style.suffix}`);
  return `<span class="${className}" style="${css}">${text}</span>`;
}

function remainingItems(items: Item[], result: ColumnsResult<MgItemData>): Item[] {
  const {end} = result;
  if (cursorDone(items, end)) return [];
  return [rebaseItem(items[end.item], end.line), ...items.slice(end.item + 1)];
}

function remainingPairs(items: Pair[], result: PairsResult<MgPairData>): Pair[] {
  const {end} = result;
  if (pairsDone(items, end)) return [];
  return [rebasePair(items[end.item], end.lines), ...items.slice(end.item + 1)];
}

function sliceFragment(
  measured: MeasuredBlock,
  absoluteFrom: number,
  absoluteTo: number,
): {html: string; className: string} {
  const {spec, lines} = measured;
  const {start} = lines[absoluteFrom];
  const end = absoluteTo < lines.length ? lines[absoluteTo].start : spec.tokens.length;
  const classes = [spec.className];
  if (absoluteFrom > 0) classes.push("cont");
  const continues = absoluteTo < lines.length;
  const justifyFrom = continues ? lines[absoluteTo - 1].start : undefined;
  return {html: blockInnerHtml(spec, start, end, false, justifyFrom), className: classes.join(" ")};
}

function renderFragment(
  fragment: {item: Item; fromLine: number; toLine: number; spaceBefore: number; height: number},
  key: string,
): RenderedFragment {
  const {measured, lineOffset} = fragment.item.data;
  const {spec} = measured;
  const slice = sliceFragment(
    measured, lineOffset + fragment.fromLine, lineOffset + fragment.toLine);
  return {
    key,
    ref: fragment.item.data.entry?.ref,
    className: slice.className,
    style: spec.style,
    dir: spec.dir,
    lang: spec.lang,
    html: slice.html,
    spaceBefore: fragment.spaceBefore,
    height: fragment.height,
  };
}

function groupByCommentator<T extends {data: {kind: string; commentator?: string}}>(
  items: T[],
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const {kind, commentator} = item.data;
    if (kind === "chead" || kind === "note-head" || kind === "translation" || !commentator) continue;
    if (!result.has(commentator)) result.set(commentator, []);
    result.get(commentator)!.push(item);
  }
  return result;
}

function effectiveEnglish(
  config: CommentatorConfig,
  override: {showEnglish?: boolean},
  hasEnglish: boolean,
): EnglishMode {
  if (!hasEnglish || override.showEnglish === false) return "none";
  if (override.showEnglish === true) return config.english === "none" ? "footnote" : config.english;
  return config.english;
}

export function paginateMikraot(doc: MikraotDocument, chapters: MikraotChapter[]): MikraotLayout {
  const startTime = performance.now();
  const {layout, typography} = doc;
  const box = pageBox(doc.page);
  const cssVars = mikraotCssVars(doc);
  setMeasurementContext("print-root mikraot", cssVars);

  const W = box.contentWidthPx;
  const gap = layout.columnGapPt * PT;
  const regionGap = layout.regionGapPt * PT;
  const headerGap = 9 * PT;
  const footerGap = 6 * PT;
  const notesRuleHeight = 7 * PT;
  const stackGap = 6 * PT;
  const tier1Width = columnWidth(W, layout.tier1Columns, gap);
  const tier2Width = columnWidth(W, layout.tier2Columns, gap);
  const notesWidth = columnWidth(W, layout.notesColumns, gap);
  const pairHebrewWidth = (W - gap) * 0.56;
  const pairEnglishWidth = W - gap - pairHebrewWidth;
  const tierWidth = (tier: TierNumber) => (tier === 1 ? tier1Width : tier2Width);
  const tierColumns = (tier: TierNumber) => (
    tier === 1 ? layout.tier1Columns : layout.tier2Columns);

  // ---- Main text geometry
  const targumId = chapters.length > 0
    ? Object.keys(chapters[0].commentaries).find(id => COMMENTATORS_BY_ID[id]?.isTargum)
    : undefined;
  const showTargum = layout.showTargum && targumId !== undefined;
  const mainEnglish: MikraotLayout["geometry"]["mainEnglish"] = layout.mainEnglish === "side-by-side"
    ? "beside"
    : (layout.mainEnglish === "stacked" ? "below" : "none");
  let mainWidth = W;
  let targumWidth = 0;
  let englishWidth = 0;
  if (mainEnglish === "beside") {
    const usable = W - gap * (showTargum ? 2 : 1);
    mainWidth = usable * (showTargum ? 0.47 : 0.56);
    targumWidth = showTargum ? usable * 0.2 : 0;
    englishWidth = usable - mainWidth - targumWidth;
  } else {
    if (showTargum) {
      mainWidth = (W - gap) * 0.62;
      targumWidth = W - gap - mainWidth;
    }
    englishWidth = mainEnglish === "below" ? W : 0;
  }

  const stripTrope = (html: string) => (typography.showTrope ? html : html.replace(TROPE_RE, ""));

  // ---- Verses
  const verses: GlobalVerse[] = [];
  for (const chapter of chapters) {
    chapter.verses.forEach((verse, i) => {
      verses.push({
        chapter: chapter.chapter,
        verse: i + 1,
        he: stripTrope(verse.he),
        en: verse.en,
        breakAfter: verse.breakAfter,
        targum: showTargum
          ? chapter.commentaries[targumId!]?.verses[i]?.map(x => x.he).join(" ")
          : undefined,
      });
    });
  }
  const verseIndex = new Map<string, number>();
  verses.forEach((x, i) => verseIndex.set(`${x.chapter}:${x.verse}`, i));

  // ---- Commentators and their typography
  const activeCommentators: CommentatorConfig[] = doc.commentators.filter(x => {
    if (x.tier === 0) return false;
    if (COMMENTATORS_BY_ID[x.id]?.isTargum) return false;
    return resolveCommentator(x, doc.book) !== undefined;
  });
  const configById = new Map(activeCommentators.map(x => [x.id, x]));
  const commentatorOrder = new Map(activeCommentators.map((x, i) => [x.id, i]));
  const names = (id: string) => resolveCommentator(configById.get(id)!, doc.book)!;

  const tierSizePt = (tier: TierNumber) => (
    tier === 1 ? typography.tier1SizePt : typography.tier2SizePt);
  const hebrewSizePt = (config: CommentatorConfig, tier: TierNumber) => (
    config.sizePt ?? tierSizePt(tier));
  const hebrewStyle = (config: CommentatorConfig, tier: TierNumber) => [
    `font-family: ${fontFamily(config.font ?? typography.commentaryFont)}`,
    `font-size: ${hebrewSizePt(config, tier)}pt`,
  ].join("; ");
  const englishStyle = (config: CommentatorConfig) => [
    `font-family: ${mixedFontFamily(config.englishFont ?? typography.englishFont, typography.mainFont)}`,
    `font-size: ${config.englishSizePt ?? typography.englishSizePt}pt`,
  ].join("; ");
  const noteStyle = (config: CommentatorConfig) => [
    config.englishFont ? `font-family: ${mixedFontFamily(config.englishFont, typography.mainFont)}` : "",
    config.englishSizePt ? `font-size: ${config.englishSizePt}pt` : "",
  ].filter(x => x).join("; ") || undefined;

  // ---- Commentary entries
  interface PendingEntry {
    ref: string;
    commentator: string;
    tier: TierNumber;
    verseIndex: number;
    english: EnglishMode;
    heSpec?: BlockSpec;
    heWidth?: number;
    enSpec?: BlockSpec;
    enWidth?: number;
    noteSpec?: BlockSpec;
    // Line limit (0 = none), and the comment's English for the addendum if it is cut.
    maxLines: number;
    englishHtml?: string;
  }
  const pendingEntries: PendingEntry[] = [];
  for (const chapter of chapters) {
    for (const config of activeCommentators) {
      const commentary = chapter.commentaries[config.id];
      if (!commentary) continue;
      // English-only commentaries (e.g. Rav Hirsch) are set in English. In a commentary with
      // Hebrew, a segment that only has English is a translation artifact and is skipped.
      const englishOnly = commentary.verses.every(x => x.every(c => !c.he.trim()));
      commentary.verses.forEach((comments, v) => {
        let firstOnVerse = true;
        comments.forEach(comment => {
          const override = doc.commentOverrides[comment.ref] ?? {};
          if (override.hidden) return;
          const tier = (override.tier ?? config.tier) as Tier;
          const hasHebrew = comment.he.trim().length > 0;
          const hasEnglish = comment.en.trim().length > 0;
          if (tier === 0 || (!hasHebrew && (!hasEnglish || !englishOnly))) return;
          const index = verseIndex.get(`${chapter.chapter}:${v + 1}`);
          if (index === undefined) return;
          const label = firstOnVerse ? `${labelHtml(typography.commentLabel, v + 1, "mg-vlabel")} ` : "";
          const englishLabel = firstOnVerse
            ? `<span class="mg-envlabel">${chapter.chapter}:${v + 1}</span> `
            : "";
          firstOnVerse = false;
          const pair = config.english === "side-by-side";
          if (!hasHebrew) {
            // An English-only commentary (e.g. Rav Hirsch, translated from German): its English is
            // the comment itself, in its column (or the English lane when side by side).
            pendingEntries.push({
              maxLines: override.maxLines ?? config.maxLines ?? layout.maxCommentLines ?? 0,
              ref: comment.ref,
              commentator: config.id,
              tier,
              verseIndex: index,
              english: pair ? "side-by-side" : "stacked",
              enSpec: {
                key: `en:${comment.ref}`,
                className: `blk mg-comment-en tier-${tier}`,
                style: englishStyle(config),
                dir: "ltr",
                lang: "en",
                tokens: tokenize(englishLabel + comment.en),
              },
              enWidth: pair ? pairEnglishWidth : tierWidth(tier),
            });
            return;
          }
          const english = effectiveEnglish(config, override, hasEnglish);
          const heWidth = english === "side-by-side" ? pairHebrewWidth : tierWidth(tier);
          pendingEntries.push({
            maxLines: override.maxLines ?? config.maxLines ?? layout.maxCommentLines ?? 0,
            englishHtml: english !== "none" ? comment.en : undefined,
            ref: comment.ref,
            commentator: config.id,
            tier,
            verseIndex: index,
            english,
            heSpec: {
              key: `he:${comment.ref}`,
              className: `blk mg-comment tier-${tier}`,
              style: hebrewStyle(config, tier),
              dir: "rtl",
              tokens: tokenize(label + comment.he),
            },
            heWidth,
            enSpec: english === "stacked" || english === "side-by-side"
              ? {
                key: `en:${comment.ref}`,
                className: `blk mg-comment-en tier-${tier}`,
                style: englishStyle(config),
                dir: "ltr",
                lang: "en",
                tokens: tokenize(comment.en),
              }
              : undefined,
            enWidth: english === "side-by-side" ? pairEnglishWidth : tierWidth(tier),
            noteSpec: english === "footnote"
              ? {
                key: `note:${comment.ref}`,
                className: "blk mg-note",
                style: noteStyle(config),
                dir: "ltr",
                lang: "en",
                tokens: tokenize(`<span class="ref">${chapter.chapter}:${v + 1}</span> ${comment.en}`),
              }
              : undefined,
          });
        });
      });
    }
  }

  // Measure everything in a few batches (one per width).
  const batches = new Map<number, BlockSpec[]>();
  const queueSpec = (spec: BlockSpec | undefined, width: number | undefined) => {
    if (!spec || width === undefined) return;
    if (!batches.has(width)) batches.set(width, []);
    batches.get(width)!.push(spec);
  };
  for (const entry of pendingEntries) {
    queueSpec(entry.heSpec, entry.heWidth);
    queueSpec(entry.enSpec, entry.enWidth);
    queueSpec(entry.noteSpec, notesWidth);
  }
  for (const [width, specs] of batches) measureBlocks(specs, width);
  const measure = (spec: BlockSpec, width: number) => measureBlocks([spec], width)[0];

  const entries: CommentEntry[] = pendingEntries.map(x => ({
    ref: x.ref,
    commentator: x.commentator,
    tier: x.tier,
    verseIndex: x.verseIndex,
    english: x.english,
    he: x.heSpec ? measure(x.heSpec, x.heWidth!) : undefined,
    en: x.enSpec ? measure(x.enSpec, x.enWidth!) : undefined,
    note: x.noteSpec ? measure(x.noteSpec, notesWidth) : undefined,
  }));

  // ---- Line limits: a comment longer than its limit keeps its first lines here, ending with a
  // reference to an addendum at the end of the book, where the rest (and its English) is set.
  interface Addendum {
    number: number;
    entry: CommentEntry;
    rest: BlockSpec;
    width: number;
    english?: string;
  }
  const addenda: Addendum[] = [];
  const hebrewNumeral = (n: number) => {
    const hebrew = intToHebrewNumeral(n);
    return hebrew.length === 1 ? `${hebrew}׳` : `${hebrew.slice(0, -1)}״${hebrew.slice(-1)}`;
  };
  entries.forEach((entry, i) => {
    const limit = pendingEntries[i].maxLines;
    const block = entry.he ?? entry.en;
    if (!limit || limit <= 0 || !block || block.lines.length <= limit) return;
    const number = addenda.length + 1;
    const {spec} = block;
    const marker = tokenize(entry.he
      ? `<span class="mg-addendum-ref">(המשך בנספח ${hebrewNumeral(number)})</span>`
      : `<span class="mg-addendum-ref">(continued in addendum ${number})</span>`);
    // Keep as many whole lines as fit with the marker within the limit.
    let cut = limit;
    let head: MeasuredBlock | undefined;
    for (; cut >= 1; cut--) {
      head = measure({
        ...spec,
        key: `${spec.key}:head:${cut}:${number}`,
        tokens: [...spec.tokens.slice(0, block.lines[cut].start), ...marker],
      }, block.width);
      if (head.lines.length <= limit) break;
    }
    if (!head || cut < 1) return;
    const ellipsis = tokenize("…");
    addenda.push({
      number,
      entry,
      width: block.width,
      english: entry.he ? pendingEntries[i].englishHtml : undefined,
      rest: {
        ...spec,
        key: `${spec.key}:rest`,
        tokens: [...ellipsis, ...spec.tokens.slice(block.lines[cut].start)],
      },
    });
    if (entry.he) {
      entry.he = head;
      // The English translates the whole comment, so it moves to the addendum with the rest.
      entry.en = undefined;
      entry.note = undefined;
    } else {
      entry.en = head;
    }
  });

  // Wrapping (as the web app's translationWrapped): the Hebrew floats at the start of a single
  // English block, which flows beside it and then continues full-width below.
  entries.forEach(entry => {
    const config = configById.get(entry.commentator);
    if (!config?.wrap || entry.english !== "side-by-side" || !entry.he || !entry.en) return;
    // A float can't break across pages: keep very long Hebrew as a plain side-by-side row.
    if (entry.he.height > 0.45 * box.contentHeightPx) return;
    const heSpec = entry.he.spec;
    const hebrewHtml = blockInnerHtml(heSpec, 0, heSpec.tokens.length, false);
    // Line up the first baselines: push down whichever side starts higher.
    const drop = entry.he.baseline - entry.en.baseline;
    const floatStyle = [
      "float: right",
      `width: ${pairHebrewWidth}px`,
      `margin-left: ${gap}px`,
      `margin-top: ${-drop}px`,
      "margin-bottom: 0.15em",
      heSpec.style ?? "",
    ].join("; ");
    entry.wrapped = measure({
      key: `wrap:${entry.ref}`,
      className: `${entry.en.spec.className} mg-wrap`,
      style: `${entry.en.spec.style ?? ""}; padding-top: ${Math.max(0, drop)}px`,
      dir: "ltr",
      lang: "en",
      tokens: entry.en.spec.tokens,
      leadHtml: `<div class="float-lead ${heSpec.className}" dir="rtl" style="${floatStyle}">${hebrewHtml}</div>`,
    }, W);
  });

  const fontPx = (id: string, tier: TierNumber) => hebrewSizePt(configById.get(id)!, tier) * PT;
  const notesFontPx = typography.notesSizePt * PT;

  // ---- Headings

  // "פסוק ב׳" (or "פרק א פסוק ב׳" when the document spans chapters), in the commentary labels'
  // numeral style.
  const multipleChapters = chapters.length > 1;
  const numeral = (n: number) => {
    if (typography.commentLabel.numerals === "arabic") return String(n);
    const hebrew = intToHebrewNumeral(n);
    return hebrew.length === 1 ? `${hebrew}׳` : `${hebrew.slice(0, -1)}״${hebrew.slice(-1)}`;
  };
  const continuationLabel = (verse: number) => {
    const {chapter, verse: number} = verses[verse];
    return multipleChapters
      ? `פרק ${numeral(chapter)} פסוק ${numeral(number)}`
      : `פסוק ${numeral(number)}`;
  };
  const headingCache = new Map<string, MeasuredBlock>();
  const headingBlock = (
    id: string,
    tier: TierNumber,
    // The verse (index into `verses`) a continued commentary resumes, if it is continued.
    continuedVerse: number | undefined,
    width: number,
  ): MeasuredBlock => {
    const key = `${id}:${tier}:${continuedVerse}:${width}`;
    if (!headingCache.has(key)) {
      const name = escapeHtml(names(id).hebrewName);
      headingCache.set(key, measure({
        key: `chead:${key}`,
        className: `blk mg-chead tier-${tier}`,
        style: `font-size: ${hebrewSizePt(configById.get(id)!, tier) * 1.15}pt`,
        dir: "rtl",
        tokens: tokenize(continuedVerse === undefined
          ? name
          : `${name} <span class="cont">(המשך ${continuationLabel(continuedVerse)})</span>`),
      }, width));
    }
    return headingCache.get(key)!;
  };

  const columnHeading = (id: string, tier: TierNumber, continuedVerse?: number): Item => {
    const block = headingBlock(id, tier, continuedVerse, tierWidth(tier));
    return {
      block,
      spaceBefore: 0.55 * fontPx(id, tier),
      keepWithNext: true,
      unsplittable: true,
      data: {kind: "chead", measured: block, lineOffset: 0, commentator: id},
    };
  };

  const pairHeading = (id: string, tier: TierNumber, continuedVerse?: number): Pair => {
    const block = headingBlock(id, tier, continuedVerse, W);
    return {
      lanes: [block],
      shifts: [0],
      spaceBefore: 0.55 * fontPx(id, tier),
      keepWithNext: true,
      unsplittable: true,
      data: {kind: "chead", measured: [block], lineOffsets: [0], commentator: id},
    };
  };

  const noteHeading = (id: string): Item => {
    const key = `nhead:${id}`;
    if (!headingCache.has(key)) {
      headingCache.set(key, measure({
        key,
        className: "blk mg-note-head",
        dir: "ltr",
        tokens: tokenize(escapeHtml(names(id).englishName)),
      }, notesWidth));
    }
    const block = headingCache.get(key)!;
    return {
      block,
      spaceBefore: 0.4 * notesFontPx,
      keepWithNext: true,
      unsplittable: true,
      data: {kind: "note-head", measured: block, lineOffset: 0, commentator: id},
    };
  };

  // ---- Items for an entry
  const columnItems = (entry: CommentEntry): Item[] => {
    const spaceBefore = 0.3 * fontPx(entry.commentator, entry.tier);
    if (!entry.he) {
      return [{
        block: entry.en!,
        spaceBefore,
        data: {kind: "comment", measured: entry.en!, lineOffset: 0, commentator: entry.commentator, entry},
      }];
    }
    const items: Item[] = [{
      block: entry.he,
      spaceBefore,
      keepWithNext: entry.english === "stacked",
      data: {kind: "comment", measured: entry.he, lineOffset: 0, commentator: entry.commentator, entry},
    }];
    if (entry.english === "stacked" && entry.en) {
      items.push({
        block: entry.en,
        spaceBefore: 0.15 * fontPx(entry.commentator, entry.tier),
        data: {kind: "comment-en", measured: entry.en, lineOffset: 0, commentator: entry.commentator, entry},
      });
    }
    return items;
  };

  const pairItem = (entry: CommentEntry): Pair => {
    if (entry.wrapped) {
      return {
        lanes: [entry.wrapped],
        shifts: [0],
        spaceBefore: 0.4 * fontPx(entry.commentator, entry.tier),
        data: {
          kind: "comment", measured: [entry.wrapped], lineOffsets: [0], commentator: entry.commentator, entry,
        },
      };
    }
    const lanes = [entry.he, entry.en];
    const top = Math.max(entry.he?.baseline ?? 0, entry.en?.baseline ?? 0);
    return {
      lanes,
      shifts: lanes.map(x => (x ? top - x.baseline : 0)),
      spaceBefore: 0.4 * fontPx(entry.commentator, entry.tier),
      data: {kind: "comment", measured: lanes, lineOffsets: [0, 0], commentator: entry.commentator, entry},
    };
  };

  const noteItem = (entry: CommentEntry): Item => ({
    block: entry.note!,
    spaceBefore: 0.2 * notesFontPx,
    data: {kind: "note", measured: entry.note!, lineOffset: 0, commentator: entry.commentator, entry},
  });

  const entriesByVerse: CommentEntry[][] = verses.map(() => []);
  for (const entry of entries) entriesByVerse[entry.verseIndex].push(entry);

  // ---- Fixed page furniture
  const headerHeight = measureHtmlHeight(
    '<div class="mg-head"><span class="he">בראשית א</span><span class="en">Genesis 1</span></div>', "", W);
  const footerHeight = measureHtmlHeight('<div class="mg-foot">1</div>', "", W);
  const bodyHeight = box.contentHeightPx - headerHeight - headerGap - footerHeight - footerGap;

  // ---- Main text
  interface MainText {
    main: string;
    targum?: string;
    english?: string;
    height: number;
  }
  const mainCache = new Map<string, MainText>();
  const mainText = (from: number, count: number): MainText => {
    const key = `${from}:${count}`;
    if (mainCache.has(key)) return mainCache.get(key)!;
    if (count === 0) {
      const empty = {main: "", height: 0};
      mainCache.set(key, empty);
      return empty;
    }
    const build = (field: "he" | "targum" | "en") => {
      const english = field === "en";
      const parts: string[] = ['<div class="mg-para">'];
      for (let i = from; i < from + count; i++) {
        const verse = verses[i];
        if (verse.verse === 1) {
          if (i !== from) parts.push("</div>");
          parts.push(english
            ? `<div class="mg-chapter-en">Chapter ${verse.chapter}</div>`
            : `<div class="mg-chapter">${labelHtml(typography.chapterLabel, verse.chapter, "mg-chapter-label")}</div>`);
          if (i !== from) parts.push('<div class="mg-para">');
        }
        parts.push(english
          ? `<span class="mg-envnum">${verse.verse}</span>${verse.en} `
          : `${labelHtml(typography.verseLabel, verse.verse, "mg-vnum")}${verse[field] ?? ""} `);
        if (i < from + count - 1) {
          if (verse.breakAfter === "peh") parts.push('</div><div class="mg-para">');
          else if (verse.breakAfter === "samekh" && !english) parts.push('<span class="mg-setuma"></span>');
        }
      }
      parts.push("</div>");
      return parts.join("");
    };
    const main = build("he");
    const targum = showTargum ? build("targum") : undefined;
    const english = mainEnglish !== "none" ? build("en") : undefined;
    const top = Math.max(
      measureHtmlHeight(main, "mg-main", mainWidth),
      targum ? measureHtmlHeight(targum, "mg-targum", targumWidth) : 0,
      english && mainEnglish === "beside" ? measureHtmlHeight(english, "mg-main-en", englishWidth) : 0);
    const below = english && mainEnglish === "below"
      ? stackGap + measureHtmlHeight(english, "mg-main-en", englishWidth)
      : 0;
    const value = {main, targum, english, height: top + below};
    mainCache.set(key, value);
    return value;
  };

  const translationItem = (from: number, count: number): Item | undefined => {
    if (layout.mainEnglish !== "notes" || count === 0) return undefined;
    const parts: string[] = ['<span class="label">Translation</span>'];
    for (let i = from; i < from + count; i++) {
      const verse = verses[i];
      const number = verse.verse === 1 || i === from ? `${verse.chapter}:${verse.verse}` : `${verse.verse}`;
      parts.push(`<span class="vnum">${number}</span>${verse.en}`);
    }
    const measured = measure({
      key: `translation:${from}:${count}`,
      className: "blk mg-note",
      dir: "ltr",
      lang: "en",
      tokens: tokenize(parts.join(" ")),
    }, notesWidth);
    return {block: measured, spaceBefore: 0, data: {kind: "translation", measured, lineOffset: 0}};
  };

  // ---- Pagination state
  let nextVerse = 0;
  let carryColumns: Record<TierNumber, Map<string, Item[]>> = {1: new Map(), 2: new Map()};
  let carryPairs: Record<TierNumber, Map<string, Pair[]>> = {1: new Map(), 2: new Map()};
  let carryNotes: Map<string, Item[]> = new Map();
  let carryTranslation: Item[] = [];

  const sortedCommentators = (ids: Iterable<string>) => Array.from(new Set(ids))
    .sort((a, b) => (commentatorOrder.get(a) ?? 0) - (commentatorOrder.get(b) ?? 0));

  const freshEntries = (tier: TierNumber, pairs: boolean, from: number, count: number) => {
    const fresh = new Map<string, CommentEntry[]>();
    for (let i = from; i < from + count; i++) {
      for (const entry of entriesByVerse[i]) {
        if (entry.tier !== tier || (entry.english === "side-by-side") !== pairs) continue;
        if (!fresh.has(entry.commentator)) fresh.set(entry.commentator, []);
        fresh.get(entry.commentator)!.push(entry);
      }
    }
    return fresh;
  };

  const buildColumnQueue = (tier: TierNumber, from: number, count: number): Item[] => {
    const fresh = freshEntries(tier, false, from, count);
    const queue: Item[] = [];
    for (const id of sortedCommentators([...carryColumns[tier].keys(), ...fresh.keys()])) {
      const carried = carryColumns[tier].get(id) ?? [];
      const items = [...carried, ...(fresh.get(id) ?? []).flatMap(columnItems)];
      if (items.length === 0) continue;
      const continued = carried.length > 0 && carried[0].data.lineOffset > 0;
      const continuedVerse = continued ? carried[0].data.entry?.verseIndex : undefined;
      queue.push(columnHeading(id, tier, continuedVerse));
      queue.push(...items);
    }
    return queue;
  };

  const buildPairQueue = (tier: TierNumber, from: number, count: number): Pair[] => {
    const fresh = freshEntries(tier, true, from, count);
    const queue: Pair[] = [];
    for (const id of sortedCommentators([...carryPairs[tier].keys(), ...fresh.keys()])) {
      const carried = carryPairs[tier].get(id) ?? [];
      const items = [...carried, ...(fresh.get(id) ?? []).map(pairItem)];
      if (items.length === 0) continue;
      const continued = carried.length > 0 && carried[0].data.lineOffsets.some(x => x > 0);
      queue.push(pairHeading(id, tier, continued ? carried[0].data.entry?.verseIndex : undefined));
      queue.push(...items);
    }
    return queue;
  };

  const buildNotesQueue = (translation: Item[], placedEntries: CommentEntry[]): Item[] => {
    const fresh = new Map<string, Item[]>();
    for (const entry of placedEntries) {
      if (!entry.note) continue;
      if (!fresh.has(entry.commentator)) fresh.set(entry.commentator, []);
      fresh.get(entry.commentator)!.push(noteItem(entry));
    }
    const queue: Item[] = [...translation];
    for (const id of sortedCommentators([...carryNotes.keys(), ...fresh.keys()])) {
      const items = [...(carryNotes.get(id) ?? []), ...(fresh.get(id) ?? [])];
      if (items.length === 0) continue;
      queue.push(noteHeading(id), ...items);
    }
    return queue;
  };

  const emptyColumns = (): ColumnsResult<MgItemData> => ({columns: [], height: 0, end: START});
  const emptyPairs = (): PairsResult<MgPairData> => ({rows: [], height: 0, end: PAIR_START});

  // The page's commentary streams, in the order they are stacked on the page.
  type Stream =
    | {kind: "columns"; tier: TierNumber; queue: Item[]; result: ColumnsResult<MgItemData>}
    | {kind: "pairs"; tier: TierNumber; queue: Pair[]; result: PairsResult<MgPairData>};

  interface Candidate {
    count: number;
    main: MainText;
    streams: Stream[];
    notesQueue: Item[];
    notesResult: ColumnsResult<MgItemData>;
    complete: boolean;
    fill: number;
  }

  const streamDone = (stream: Stream) => (stream.kind === "columns"
    ? cursorDone(stream.queue, stream.result.end)
    : pairsDone(stream.queue, stream.result.end));

  const evaluate = (count: number): Candidate => {
    const main = mainText(nextVerse, count);
    const queues = {
      columns: {1: buildColumnQueue(1, nextVerse, count), 2: buildColumnQueue(2, nextVerse, count)},
      pairs: {1: buildPairQueue(1, nextVerse, count), 2: buildPairQueue(2, nextVerse, count)},
    };
    const translation = [...carryTranslation];
    const newTranslation = translationItem(nextVerse, count);
    if (newTranslation) translation.push(newTranslation);

    const afterMain = bodyHeight - main.height - (main.height > 0 ? regionGap : 0);
    // Let the notes catch up (up to 1.5x their usual share) when they are lagging behind, but never
    // take more than what's left below the main text.
    const notesCap = Math.max(0, Math.min(
      afterMain - notesRuleHeight - regionGap,
      bodyHeight * (carryNotes.size > 0
        ? Math.min(0.5, layout.maxNotesFraction * 1.5)
        : layout.maxNotesFraction)));

    const layoutStreams = (space: number): Stream[] => {
      const streams: Stream[] = [];
      let remaining = space;
      let first = true;
      for (const tier of [1, 2] as const) {
        const columns = queues.columns[tier];
        const pairs = queues.pairs[tier];
        // Within a tier, the column and side-by-side streams follow the commentators' order.
        const firstOrder = (items: {data: {commentator?: string}}[]) => Math.min(
          Infinity, ...items.map(x => commentatorOrder.get(x.data.commentator ?? "") ?? Infinity));
        const pairsFirst = firstOrder(pairs) < firstOrder(columns);
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const placeColumns = () => {
          if (columns.length === 0) return;
          const available = remaining - (first ? 0 : regionGap);
          const result = available > 2 * tierSizePt(tier) * PT || first
            ? fillColumnsBalanced(
              columns, START, tierColumns(tier), Math.max(0, available), undefined, !first)
            : emptyColumns();
          streams.push({kind: "columns", tier, queue: columns, result});
          if (result.height > 0) {
            remaining = available - result.height;
            first = false;
          }
        };
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const placePairs = () => {
          if (pairs.length === 0) return;
          const available = remaining - (first ? 0 : regionGap);
          const result = available > 2 * tierSizePt(tier) * PT || first
            ? fillPairs(pairs, PAIR_START, Math.max(0, available), undefined, !first)
            : emptyPairs();
          streams.push({kind: "pairs", tier, queue: pairs, result});
          if (result.height > 0) {
            remaining = available - result.height;
            first = false;
          }
        };
        if (pairsFirst) {
          placePairs();
          placeColumns();
        } else {
          placeColumns();
          placePairs();
        }
      }
      return streams;
    };

    let notesReserved = 0;
    let streams: Stream[] = [];
    let notesQueue: Item[] = [];
    for (let iteration = 0; iteration < 4; iteration++) {
      const notesSpace = notesReserved > 0 ? notesReserved + notesRuleHeight + regionGap : 0;
      streams = layoutStreams(afterMain - notesSpace);

      const placed: CommentEntry[] = [];
      for (const stream of streams) {
        if (stream.kind === "columns") {
          for (const column of stream.result.columns) {
            for (const fragment of column.fragments) {
              const {data} = fragment.item;
              if (data.kind === "comment" && fragment.isFirst && data.lineOffset === 0) placed.push(data.entry!);
            }
          }
        } else {
          for (const row of stream.result.rows) {
            const {data} = row.item;
            if (data.kind === "comment" && row.isFirst && data.lineOffsets.every(x => x === 0)) {
              placed.push(data.entry!);
            }
          }
        }
      }
      notesQueue = buildNotesQueue(translation, placed);
      const needed = notesQueue.length === 0
        ? 0
        : fillColumnsBalanced(notesQueue, START, layout.notesColumns, notesCap).height;
      if (Math.abs(needed - notesReserved) < 1) break;
      // Converged from above: keep the reservation (the extra space just stays white).
      if (iteration > 0 && needed < notesReserved) break;
      notesReserved = needed;
    }

    const notesResult = notesQueue.length > 0 && notesReserved > 0
      ? fillColumnsBalanced(notesQueue, START, layout.notesColumns, notesReserved, undefined, true)
      : emptyColumns();

    const complete = streams.every(streamDone) && cursorDone(notesQueue, notesResult.end);
    const streamsHeight = streams
      .filter(x => x.result.height > 0)
      .reduce((total, x) => total + regionGap + x.result.height, 0);
    const used = main.height
      + streamsHeight
      + (notesResult.height > 0 ? regionGap + notesRuleHeight + notesResult.height : 0);
    return {count, main, streams, notesQueue, notesResult, complete, fill: used / bodyHeight};
  };

  const hasCarry = () => [1, 2].some(tier => (
    carryColumns[tier as TierNumber].size > 0 || carryPairs[tier as TierNumber].size > 0))
    || carryNotes.size > 0
    || carryTranslation.length > 0;

  // How many verses the main text has advanced past the oldest commentary still waiting to be set.
  const commentaryLag = (): number => {
    let oldest = nextVerse;
    for (const tier of [1, 2] as const) {
      for (const items of carryColumns[tier].values()) {
        for (const item of items) {
          if (item.data.entry) oldest = Math.min(oldest, item.data.entry.verseIndex);
        }
      }
      for (const items of carryPairs[tier].values()) {
        for (const item of items) {
          if (item.data.entry) oldest = Math.min(oldest, item.data.entry.verseIndex);
        }
      }
    }
    return nextVerse - oldest;
  };

  const choose = (): Candidate => {
    const carryOnly = evaluate(0);
    if (nextVerse >= verses.length) return carryOnly;
    // Long commentaries (e.g. Ramban on Genesis 1:1) may run for pages. Keep the main text moving
    // along with them, but only until the commentary lags `maxCommentaryLag` verses behind.
    if (hasCarry() && !carryOnly.complete && commentaryLag() >= layout.maxCommentaryLag) {
      return carryOnly;
    }

    let lastComplete: Candidate | undefined;
    let firstIncomplete: Candidate | undefined;
    for (let count = 1; nextVerse + count <= verses.length; count++) {
      const tooTall = mainText(nextVerse, count).height > layout.maxMainFraction * bodyHeight;
      if (count > 1 && tooTall) break;
      const candidate = evaluate(count);
      if (candidate.complete) {
        lastComplete = candidate;
      } else {
        firstIncomplete = candidate;
        break;
      }
    }
    if (lastComplete && (lastComplete.fill >= layout.minPageFill || !firstIncomplete)) {
      return lastComplete;
    }
    // Space-filling: rather than leave the page mostly white, take one more verse and let its
    // commentary continue on the next page.
    return firstIncomplete ?? carryOnly;
  };

  const columnsRegion = (
    kind: RegionKind,
    result: ColumnsResult<MgItemData>,
    count: number,
    width: number,
    pageIndex: number,
  ): RegionLayout => ({
    kind,
    columnCount: count,
    columnWidth: width,
    height: result.height,
    columns: result.columns.map((column, c) => column.fragments.map((fragment, f) => (
      renderFragment(fragment, `${pageIndex}:${kind}:${c}:${f}`)))),
  });

  const pairsRegion = (
    kind: RegionKind,
    result: PairsResult<MgPairData>,
    pageIndex: number,
  ): RegionLayout => ({
    kind,
    columnCount: 1,
    columnWidth: W,
    height: result.height,
    columns: [],
    rows: result.rows.map((row, r) => {
      const {data} = row.item;
      return {
        key: `${pageIndex}:${kind}:${r}`,
        spaceBefore: row.spaceBefore,
        height: row.height,
        span: row.item.lanes.length === 1,
        lanes: data.measured.map((measured, lane) => {
          if (!measured || row.to[lane] <= row.from[lane]) return undefined;
          const offset = data.lineOffsets[lane];
          const slice = sliceFragment(measured, offset + row.from[lane], offset + row.to[lane]);
          const lines = row.item.lanes[lane]!;
          const top = row.from[lane] === 0 ? 0 : lines.lines[row.from[lane] - 1].bottom;
          return {
            key: `${pageIndex}:${kind}:${r}:${lane}`,
            ref: data.entry?.ref,
            className: slice.className,
            style: measured.spec.style,
            dir: measured.spec.dir,
            lang: measured.spec.lang,
            html: slice.html,
            spaceBefore: 0,
            height: lines.lines[row.to[lane] - 1].bottom - top,
            offset: row.item.shifts[lane],
          };
        }),
      };
    }),
  });

  const pages: MgPage[] = [];
  let lastVerse = 0;
  while ((nextVerse < verses.length || hasCarry()) && pages.length < 2000) {
    const candidate = choose();
    const pageIndex = pages.length;
    const regions: RegionLayout[] = [];
    for (const stream of candidate.streams) {
      if (stream.result.height <= 0) continue;
      if (stream.kind === "columns") {
        regions.push(columnsRegion(
          `tier-${stream.tier}` as RegionKind, stream.result, tierColumns(stream.tier),
          tierWidth(stream.tier), pageIndex));
      } else {
        regions.push(pairsRegion(`tier-${stream.tier}-pairs` as RegionKind, stream.result, pageIndex));
      }
    }
    if (candidate.notesResult.height > 0) {
      regions.push(columnsRegion("notes", candidate.notesResult, layout.notesColumns, notesWidth, pageIndex));
    }

    const first = verses[candidate.count > 0 ? nextVerse : lastVerse];
    const last = verses[candidate.count > 0 ? nextVerse + candidate.count - 1 : lastVerse];
    const bookHebrew = chapters[0]?.bookHebrew ?? "";
    const chapterHebrew = first.chapter === last.chapter
      ? intToHebrewNumeral(first.chapter)
      : `${intToHebrewNumeral(first.chapter)}–${intToHebrewNumeral(last.chapter)}`;
    const range = candidate.count > 1
      ? `–${last.chapter !== first.chapter ? `${last.chapter}:` : ""}${last.verse}`
      : "";
    const hasMain = candidate.main.height > 0;
    pages.push({
      index: pageIndex,
      headerHebrew: `${bookHebrew} ${chapterHebrew}`,
      headerEnglish: candidate.count > 0
        ? `${doc.book} ${first.chapter}:${first.verse}${range}`
        : `${doc.book} ${last.chapter}:${last.verse} (cont.)`,
      mainHtml: hasMain ? candidate.main.main : undefined,
      targumHtml: hasMain ? candidate.main.targum : undefined,
      englishHtml: hasMain ? candidate.main.english : undefined,
      mainHeight: candidate.main.height,
      regions,
      verseRange: candidate.count > 0
        ? [`${first.chapter}:${first.verse}`, `${last.chapter}:${last.verse}`]
        : undefined,
    });

    // Advance state.
    if (candidate.count > 0) lastVerse = nextVerse + candidate.count - 1;
    nextVerse += candidate.count;
    const nextColumns: Record<TierNumber, Map<string, Item[]>> = {1: new Map(), 2: new Map()};
    const nextPairs: Record<TierNumber, Map<string, Pair[]>> = {1: new Map(), 2: new Map()};
    for (const stream of candidate.streams) {
      if (stream.kind === "columns") {
        nextColumns[stream.tier] = groupByCommentator(remainingItems(stream.queue, stream.result));
      } else {
        nextPairs[stream.tier] = groupByCommentator(remainingPairs(stream.queue, stream.result));
      }
    }
    carryColumns = nextColumns;
    carryPairs = nextPairs;
    const notesLeft = remainingItems(candidate.notesQueue, candidate.notesResult);
    carryTranslation = notesLeft.filter(x => x.data.kind === "translation");
    carryNotes = groupByCommentator(notesLeft);
  }


  // ---- Addenda: the continuations of comments cut by a line limit.
  if (addenda.length > 0) {
    const firstPage = new Map<string, number>();
    for (const page of pages) {
      for (const region of page.regions) {
        const fragments = [
          ...region.columns.flat(),
          ...(region.rows ?? []).flatMap(
            row => row.lanes.filter((x): x is RenderedFragment => !!x)),
        ];
        for (const fragment of fragments) {
          if (fragment.ref && !firstPage.has(fragment.ref)) firstPage.set(fragment.ref, page.index);
        }
      }
    }

    const addendaWidth = tier1Width;
    const addendaColumns = layout.tier1Columns;
    const items: Item[] = [];
    for (const addendum of addenda) {
      const {entry} = addendum;
      const config = configById.get(entry.commentator)!;
      const {hebrewName} = names(entry.commentator);
      const page = firstPage.get(entry.ref);
      const heading = measure({
        key: `addendum-head:${addendum.number}`,
        className: "blk mg-chead mg-addendum-head tier-1",
        dir: "rtl",
        tokens: tokenize(
          `${hebrewNumeral(addendum.number)}. ${escapeHtml(hebrewName)}, `
          + `${continuationLabel(entry.verseIndex)}`
          + `${page === undefined ? "" : ` <span class="cont">(עמ׳ ${page + 1})</span>`}`),
      }, addendaWidth);
      items.push({
        block: heading,
        spaceBefore: 0.8 * tierSizePt(1) * PT,
        keepWithNext: true,
        unsplittable: true,
        data: {kind: "chead", measured: heading, lineOffset: 0},
      });
      const rest = measure({...addendum.rest, key: `${addendum.rest.key}:${addendaWidth}`}, addendaWidth);
      items.push({
        block: rest,
        spaceBefore: 0,
        data: {kind: "comment", measured: rest, lineOffset: 0, commentator: entry.commentator, entry},
      });
      if (addendum.english?.trim()) {
        const english = measure({
          key: `addendum-en:${addendum.number}`,
          className: "blk mg-comment-en tier-1",
          style: englishStyle(config),
          dir: "ltr",
          lang: "en",
          tokens: tokenize(addendum.english),
        }, addendaWidth);
        items.push({
          block: english,
          spaceBefore: 0.3 * tierSizePt(1) * PT,
          data: {kind: "comment-en", measured: english, lineOffset: 0, commentator: entry.commentator, entry},
        });
      }
    }

    const titleHtml = '<div class="mg-addenda-title"><span class="he">המשכים</span>'
      + '<span class="en">Continuations</span></div>';
    const titleHeight = measureHtmlHeight(titleHtml, "", W);
    let cursor = START;
    let first = true;
    while (!cursorDone(items, cursor) && pages.length < 4000) {
      const available = bodyHeight - (first ? titleHeight + regionGap : 0);
      let result = fillColumns(items, cursor, addendaColumns, available);
      if (cursorDone(items, result.end)) {
        // The last page: balance its columns.
        result = fillColumnsBalanced(items, cursor, addendaColumns, available);
      }
      const pageIndex = pages.length;
      pages.push({
        index: pageIndex,
        headerHebrew: "המשכים",
        headerEnglish: "Continuations",
        titleHtml: first ? titleHtml : undefined,
        titleHeight: first ? titleHeight : undefined,
        mainHeight: 0,
        regions: [columnsRegion("tier-1", result, addendaColumns, addendaWidth, pageIndex)],
      });
      cursor = result.end;
      first = false;
    }
  }

  return {
    pages,
    cssVars,
    geometry: {
      widthPx: box.widthPx,
      heightPx: box.heightPx,
      contentWidth: W,
      contentHeight: box.contentHeightPx,
      headerHeight,
      footerHeight,
      headerGap,
      footerGap,
      regionGap,
      notesRuleHeight,
      mainWidth,
      targumWidth,
      englishWidth,
      mainEnglish,
      stackGap,
      pairHebrewWidth,
      pairEnglishWidth,
      columnGap: gap,
    },
    marginsFor: box.marginsFor,
    stats: {
      verses: verses.length,
      comments: entries.length,
      notes: entries.filter(x => x.note).length,
      millis: Math.round(performance.now() - startTime),
    },
  };
}
