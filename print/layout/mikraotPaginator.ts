// Mikraot Gedolot pagination. See print/README.md for the design.
//
// Page anatomy (top to bottom): running head · main text (+ optional targum) · tier-1 commentary ·
// tier-2 commentary · English notes · folio.

import {intToHebrewNumeral} from "../../hebrew";
import {MikraotChapter} from "../model/dataTypes";
import {CommentatorConfig, MikraotDocument, Tier} from "../model/documents";
import {fontFamily, mixedFontFamily} from "../model/fonts";
import {pageBox} from "../model/geometry";
import {COMMENTATORS_BY_ID} from "../model/mikraotCommentators";
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
  START,
  cursorDone,
  fillColumnsBalanced,
  rebaseItem,
  remainingHeight,
} from "./packing";

const PT = 96 / 72;

export interface MgItemData {
  kind: "chead" | "comment" | "note-head" | "note" | "translation";
  measured: MeasuredBlock;
  // Number of lines of `measured` consumed on earlier pages (for continued comments).
  lineOffset: number;
  commentator?: string;
  entry?: CommentEntry;
}

type Item = FlowItem<MgItemData>;

interface CommentEntry {
  ref: string;
  commentator: string;
  tier: 1 | 2;
  verseIndex: number;
  he: MeasuredBlock;
  note?: MeasuredBlock;
}

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
  // The comment this fragment belongs to (comments and their English notes), for selection.
  ref?: string;
  lang?: string;
  className: string;
  style?: string;
  dir: "rtl" | "ltr";
  html: string;
  spaceBefore: number;
  height: number;
}

export interface RegionLayout {
  kind: "tier-1" | "tier-2" | "notes";
  columnCount: number;
  columnWidth: number;
  height: number;
  columns: RenderedFragment[][];
}

export interface MgPage {
  index: number;
  headerHebrew: string;
  headerEnglish: string;
  mainHtml?: string;
  targumHtml?: string;
  mainHeight: number;
  regions: RegionLayout[];
  verseRange?: [string, string];
  overflowWarning?: boolean;
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


function remainingItems(items: Item[], result: ColumnsResult<MgItemData>): Item[] {
  const {end} = result;
  if (cursorDone(items, end)) return [];
  return [rebaseItem(items[end.item], end.line), ...items.slice(end.item + 1)];
}

function renderFragment(
  fragment: {item: Item; fromLine: number; toLine: number; spaceBefore: number; height: number},
  key: string,
): RenderedFragment {
  const {measured, lineOffset} = fragment.item.data;
  const {spec, lines} = measured;
  const absoluteFrom = lineOffset + fragment.fromLine;
  const absoluteTo = lineOffset + fragment.toLine;
  const {start} = lines[absoluteFrom];
  const end = absoluteTo < lines.length ? lines[absoluteTo].start : spec.tokens.length;
  const classes = [spec.className];
  if (absoluteFrom > 0) classes.push("cont");
  if (absoluteTo < lines.length) classes.push("justify-last");
  return {
    key,
    ref: fragment.item.data.entry?.ref,
    className: classes.join(" "),
    style: spec.style,
    dir: spec.dir,
    lang: spec.lang,
    html: blockInnerHtml(spec, start, end, false),
    spaceBefore: fragment.spaceBefore,
    height: fragment.height,
  };
}

function groupByCommentator(items: Item[]): Map<string, Item[]> {
  const result = new Map<string, Item[]>();
  for (const item of items) {
    if (item.data.kind === "chead" || item.data.kind === "note-head" || item.data.kind === "translation") {
      continue;
    }
    const key = item.data.commentator!;
    if (!result.has(key)) result.set(key, []);
    result.get(key)!.push(item);
  }
  return result;
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
  const tier1Width = columnWidth(W, layout.tier1Columns, gap);
  const tier2Width = columnWidth(W, layout.tier2Columns, gap);
  const notesWidth = columnWidth(W, layout.notesColumns, gap);
  const tierWidth = (tier: 1 | 2) => (tier === 1 ? tier1Width : tier2Width);

  const targumId = chapters.length > 0
    ? Object.keys(chapters[0].commentaries).find(id => COMMENTATORS_BY_ID[id]?.isTargum)
    : undefined;
  const showTargum = layout.showTargum && targumId !== undefined;
  const mainWidth = showTargum ? (W - gap) * 0.62 : W;
  const targumWidth = showTargum ? W - gap - mainWidth : 0;

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

  // ---- Commentary entries
  const activeCommentators: CommentatorConfig[] = doc.commentators.filter(
    x => x.tier > 0 && COMMENTATORS_BY_ID[x.id] && !COMMENTATORS_BY_ID[x.id].isTargum);
  const commentatorOrder = new Map(activeCommentators.map((x, i) => [x.id, i]));

  interface PendingEntry {
    ref: string;
    commentator: string;
    tier: 1 | 2;
    verseIndex: number;
    heSpec: BlockSpec;
    noteSpec?: BlockSpec;
  }
  const pendingEntries: PendingEntry[] = [];
  for (const chapter of chapters) {
    for (const config of activeCommentators) {
      const commentary = chapter.commentaries[config.id];
      if (!commentary) continue;
      commentary.verses.forEach((comments, v) => {
        let firstOnVerse = true;
        comments.forEach(comment => {
          const override = doc.commentOverrides[comment.ref] ?? {};
          if (override.hidden) return;
          const tier = (override.tier ?? config.tier) as Tier;
          if (tier === 0 || !comment.he.trim()) return;
          const label = firstOnVerse ? `<span class="mg-vlabel">${intToHebrewNumeral(v + 1)}</span> ` : "";
          firstOnVerse = false;
          const showEnglish = override.showEnglish ?? config.showEnglish;
          const index = verseIndex.get(`${chapter.chapter}:${v + 1}`);
          if (index === undefined) return;
          pendingEntries.push({
            ref: comment.ref,
            commentator: config.id,
            tier: tier as 1 | 2,
            verseIndex: index,
            heSpec: {
              key: `he:${comment.ref}`,
              className: `blk mg-comment tier-${tier}`,
              dir: "rtl",
              tokens: tokenize(label + comment.he),
            },
            noteSpec: showEnglish && comment.en.trim()
              ? {
                key: `en:${comment.ref}`,
                className: "blk mg-note",
                dir: "ltr",
                lang: "en",
                tokens: tokenize(
                  `<span class="ref">${chapter.chapter}:${v + 1}</span> ${comment.en}`),
              }
              : undefined,
          });
        });
      });
    }
  }

  // Measure everything in a few batches.
  for (const tier of [1, 2] as const) {
    const entries = pendingEntries.filter(x => x.tier === tier);
    measureBlocks(entries.map(x => x.heSpec), tierWidth(tier));
  }
  measureBlocks(pendingEntries.filter(x => x.noteSpec).map(x => x.noteSpec!), notesWidth);
  const entries: CommentEntry[] = pendingEntries.map(x => ({
    ref: x.ref,
    commentator: x.commentator,
    tier: x.tier,
    verseIndex: x.verseIndex,
    he: measureBlocks([x.heSpec], tierWidth(x.tier))[0],
    note: x.noteSpec ? measureBlocks([x.noteSpec], notesWidth)[0] : undefined,
  }));

  const tierFontPx = (tier: 1 | 2): number => (
    (tier === 1 ? typography.tier1SizePt : typography.tier2SizePt) * PT);

  const headingCache = new Map<string, MeasuredBlock>();
  const commentatorHeading = (id: string, tier: 1 | 2, continued: boolean): Item => {
    const key = `${id}:${tier}:${continued}`;
    if (!headingCache.has(key)) {
      const name = COMMENTATORS_BY_ID[id].hebrewName;
      headingCache.set(key, measureBlocks([{
        key: `chead:${key}`,
        className: `blk mg-chead tier-${tier}`,
        dir: "rtl",
        tokens: tokenize(continued ? `${name} <span class="cont">(המשך)</span>` : name),
      }], tierWidth(tier))[0]);
    }
    return {
      block: headingCache.get(key)!,
      spaceBefore: 0.55 * tierFontPx(tier),
      keepWithNext: true,
      unsplittable: true,
      data: {kind: "chead", measured: headingCache.get(key)!, lineOffset: 0, commentator: id},
    };
  };
  const notesFontPx = typography.notesSizePt * PT;

  const noteHeading = (id: string): Item => {
    const key = `nhead:${id}`;
    if (!headingCache.has(key)) {
      headingCache.set(key, measureBlocks([{
        key,
        className: "blk mg-note-head",
        dir: "ltr",
        tokens: tokenize(COMMENTATORS_BY_ID[id].englishName),
      }], notesWidth)[0]);
    }
    return {
      block: headingCache.get(key)!,
      spaceBefore: 0.4 * notesFontPx,
      keepWithNext: true,
      unsplittable: true,
      data: {kind: "note-head", measured: headingCache.get(key)!, lineOffset: 0, commentator: id},
    };
  };

  const commentItem = (entry: CommentEntry): Item => ({
    block: entry.he,
    spaceBefore: 0.3 * tierFontPx(entry.tier),
    data: {kind: "comment", measured: entry.he, lineOffset: 0, commentator: entry.commentator, entry},
  });

  const noteItem = (entry: CommentEntry): Item => ({
    block: entry.note!,
    spaceBefore: 0.2 * notesFontPx,
    data: {kind: "note", measured: entry.note!, lineOffset: 0, commentator: entry.commentator, entry},
  });

  // Entries grouped by verse for quick lookup.
  const entriesByVerse: CommentEntry[][] = verses.map(() => []);
  for (const entry of entries) entriesByVerse[entry.verseIndex].push(entry);

  // ---- Fixed page furniture
  const headerHeight = measureHtmlHeight(
    '<div class="mg-head"><span class="he">בראשית א</span><span class="en">Genesis 1</span></div>', "", W);
  const footerHeight = measureHtmlHeight('<div class="mg-foot">1</div>', "", W);
  const bodyHeight = box.contentHeightPx - headerHeight - headerGap - footerHeight - footerGap;

  // ---- Main text
  const mainCache = new Map<string, {main: string; targum?: string; height: number}>();
  const mainText = (from: number, count: number) => {
    const key = `${from}:${count}`;
    if (mainCache.has(key)) return mainCache.get(key)!;
    if (count === 0) {
      const empty = {main: "", height: 0};
      mainCache.set(key, empty);
      return empty;
    }
    const build = (field: "he" | "targum") => {
      const parts: string[] = ['<div class="mg-para">'];
      for (let i = from; i < from + count; i++) {
        const verse = verses[i];
        if (verse.verse === 1) {
          if (i !== from) parts.push('</div>');
          parts.push(`<div class="mg-chapter">פרק ${intToHebrewNumeral(verse.chapter)}</div>`);
          if (i !== from) parts.push('<div class="mg-para">');
        }
        parts.push(`<span class="mg-vnum">${intToHebrewNumeral(verse.verse)}</span>${verse[field] ?? ""} `);
        if (i < from + count - 1) {
          if (verse.breakAfter === "peh") parts.push('</div><div class="mg-para">');
          else if (verse.breakAfter === "samekh") parts.push('<span class="mg-setuma"></span>');
        }
      }
      parts.push("</div>");
      return parts.join("");
    };
    const main = build("he");
    const targum = showTargum ? build("targum") : undefined;
    const height = Math.max(
      measureHtmlHeight(main, "mg-main", mainWidth),
      targum ? measureHtmlHeight(targum, "mg-targum", targumWidth) : 0);
    const value = {main, targum, height};
    mainCache.set(key, value);
    return value;
  };

  const translationItem = (from: number, count: number): Item | undefined => {
    if (!layout.showVerseTranslation || count === 0) return undefined;
    const parts: string[] = ['<span class="label">Translation</span>'];
    for (let i = from; i < from + count; i++) {
      const verse = verses[i];
      const number = verse.verse === 1 || i === from ? `${verse.chapter}:${verse.verse}` : `${verse.verse}`;
      parts.push(`<span class="vnum">${number}</span>${verse.en}`);
    }
    const measured = measureBlocks([{
      key: `translation:${from}:${count}`,
      className: "blk mg-note",
      dir: "ltr",
      lang: "en",
      tokens: tokenize(parts.join(" ")),
    }], notesWidth)[0];
    return {block: measured, spaceBefore: 0, data: {kind: "translation", measured, lineOffset: 0}};
  };

  // ---- Pagination state
  let nextVerse = 0;
  let carryTier: Record<1 | 2, Map<string, Item[]>> = {1: new Map(), 2: new Map()};
  let carryNotes: Map<string, Item[]> = new Map();
  let carryTranslation: Item[] = [];

  const sortedCommentators = (ids: Iterable<string>) => Array.from(new Set(ids))
    .sort((a, b) => (commentatorOrder.get(a) ?? 0) - (commentatorOrder.get(b) ?? 0));

  const buildTierQueue = (tier: 1 | 2, from: number, count: number): Item[] => {
    const fresh = new Map<string, Item[]>();
    for (let i = from; i < from + count; i++) {
      for (const entry of entriesByVerse[i]) {
        if (entry.tier !== tier) continue;
        if (!fresh.has(entry.commentator)) fresh.set(entry.commentator, []);
        fresh.get(entry.commentator)!.push(commentItem(entry));
      }
    }
    const queue: Item[] = [];
    for (const id of sortedCommentators([...carryTier[tier].keys(), ...fresh.keys()])) {
      const carried = carryTier[tier].get(id) ?? [];
      const items = [...carried, ...(fresh.get(id) ?? [])];
      if (items.length === 0) continue;
      const continued = carried.length > 0 && carried[0].data.lineOffset > 0;
      queue.push(commentatorHeading(id, tier, continued));
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

  interface Candidate {
    count: number;
    main: {main: string; targum?: string; height: number};
    tierQueues: Record<1 | 2, Item[]>;
    tierResults: Record<1 | 2, ColumnsResult<MgItemData>>;
    notesQueue: Item[];
    notesResult: ColumnsResult<MgItemData>;
    complete: boolean;
    fill: number;
    carryHeight: number;
  }

  const evaluate = (count: number): Candidate => {
    const main = mainText(nextVerse, count);
    const tierQueues = {
      1: buildTierQueue(1, nextVerse, count),
      2: buildTierQueue(2, nextVerse, count),
    };
    const translation = [...carryTranslation];
    const newTranslation = translationItem(nextVerse, count);
    if (newTranslation) translation.push(newTranslation);

    const afterMain = bodyHeight - main.height - (main.height > 0 ? regionGap : 0);
    // Let the notes catch up (up to 1.5x their usual share) when they are lagging behind.
    // The notes can never take more than what's left below the main text.
    const notesCap = Math.max(0, Math.min(
      afterMain - notesRuleHeight - regionGap,
      bodyHeight * (carryNotes.size > 0
        ? Math.min(0.5, layout.maxNotesFraction * 1.5)
        : layout.maxNotesFraction)));

    let notesReserved = 0;
    let tierResults = {1: emptyColumns(), 2: emptyColumns()};
    let notesQueue: Item[] = [];
    for (let iteration = 0; iteration < 4; iteration++) {
      const notesSpace = notesReserved > 0 ? notesReserved + notesRuleHeight + regionGap : 0;
      const tierSpace = afterMain - notesSpace;
      const r1 = tierQueues[1].length > 0
        ? fillColumnsBalanced(tierQueues[1], START, layout.tier1Columns, Math.max(0, tierSpace))
        : emptyColumns();
      const remaining2 = tierSpace - r1.height - (r1.height > 0 ? regionGap : 0);
      const r2 = tierQueues[2].length > 0 && remaining2 > 2 * tierFontPx(2)
        ? fillColumnsBalanced(
          tierQueues[2], START, layout.tier2Columns, remaining2, undefined, true)
        : emptyColumns();
      tierResults = {1: r1, 2: r2};

      const placed: CommentEntry[] = [];
      for (const result of [r1, r2]) {
        for (const column of result.columns) {
          for (const fragment of column.fragments) {
            if (fragment.item.data.kind === "comment" && fragment.isFirst && fragment.item.data.lineOffset === 0) {
              placed.push(fragment.item.data.entry!);
            }
          }
        }
      }
      notesQueue = buildNotesQueue(translation, placed);
      const needed = notesQueue.length === 0
        ? 0
        : fillColumnsBalanced(notesQueue, START, layout.notesColumns, notesCap).height;
      if (Math.abs(needed - notesReserved) < 1) break;
      if (iteration > 0 && needed < notesReserved) {
        // Converged from above: keep the reservation (the extra space just stays white).
        break;
      }
      notesReserved = needed;
    }

    const notesResult = notesQueue.length > 0 && notesReserved > 0
      ? fillColumnsBalanced(notesQueue, START, layout.notesColumns, notesReserved, undefined, true)
      : emptyColumns();

    const r1 = tierResults[1];
    const r2 = tierResults[2];
    const complete = cursorDone(tierQueues[1], r1.end)
      && cursorDone(tierQueues[2], r2.end)
      && cursorDone(notesQueue, notesResult.end);
    const used = main.height
      + (r1.height > 0 ? regionGap + r1.height : 0)
      + (r2.height > 0 ? regionGap + r2.height : 0)
      + (notesResult.height > 0 ? regionGap + notesRuleHeight + notesResult.height : 0);
    const carryHeight = remainingHeight(tierQueues[1], r1.end) / layout.tier1Columns
      + remainingHeight(tierQueues[2], r2.end) / layout.tier2Columns
      + remainingHeight(notesQueue, notesResult.end) / layout.notesColumns;
    return {
      count,
      main,
      tierQueues,
      tierResults,
      notesQueue,
      notesResult,
      complete,
      fill: used / bodyHeight,
      carryHeight,
    };
  };

  const hasCarry = () => carryTier[1].size > 0 || carryTier[2].size > 0 || carryNotes.size > 0
    || carryTranslation.length > 0;

  // How many verses the main text has advanced past the oldest commentary still waiting to be set.
  const commentaryLag = (): number => {
    let oldest = nextVerse;
    for (const tier of [1, 2] as const) {
      for (const items of carryTier[tier].values()) {
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

  const toRegion = (
    kind: RegionLayout["kind"],
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

  const pages: MgPage[] = [];
  let lastVerse = 0;
  while ((nextVerse < verses.length || hasCarry()) && pages.length < 2000) {
    const candidate = choose();
    const pageIndex = pages.length;
    const regions: RegionLayout[] = [];
    if (candidate.tierResults[1].height > 0) {
      regions.push(toRegion("tier-1", candidate.tierResults[1], layout.tier1Columns, tier1Width, pageIndex));
    }
    if (candidate.tierResults[2].height > 0) {
      regions.push(toRegion("tier-2", candidate.tierResults[2], layout.tier2Columns, tier2Width, pageIndex));
    }
    if (candidate.notesResult.height > 0) {
      regions.push(toRegion("notes", candidate.notesResult, layout.notesColumns, notesWidth, pageIndex));
    }

    const first = verses[candidate.count > 0 ? nextVerse : lastVerse];
    const last = verses[candidate.count > 0 ? nextVerse + candidate.count - 1 : lastVerse];
    const bookHebrew = chapters[0]?.bookHebrew ?? "";
    const chapterHebrew = first.chapter === last.chapter
      ? intToHebrewNumeral(first.chapter)
      : `${intToHebrewNumeral(first.chapter)}–${intToHebrewNumeral(last.chapter)}`;
    pages.push({
      index: pageIndex,
      headerHebrew: `${bookHebrew} ${chapterHebrew}`,
      headerEnglish: candidate.count > 0
        ? `${doc.book} ${first.chapter}:${first.verse}${candidate.count > 1 ? `–${last.chapter !== first.chapter ? `${last.chapter}:` : ""}${last.verse}` : ""}`
        : `${doc.book} ${last.chapter}:${last.verse} (cont.)`,
      mainHtml: candidate.main.height > 0 ? candidate.main.main : undefined,
      targumHtml: candidate.main.height > 0 ? candidate.main.targum : undefined,
      mainHeight: candidate.main.height,
      regions,
      verseRange: candidate.count > 0
        ? [`${first.chapter}:${first.verse}`, `${last.chapter}:${last.verse}`]
        : undefined,
    });

    // Advance state.
    if (candidate.count > 0) lastVerse = nextVerse + candidate.count - 1;
    nextVerse += candidate.count;
    carryTier = {
      1: groupByCommentator(remainingItems(candidate.tierQueues[1], candidate.tierResults[1])),
      2: groupByCommentator(remainingItems(candidate.tierQueues[2], candidate.tierResults[2])),
    };
    const notesLeft = remainingItems(candidate.notesQueue, candidate.notesResult);
    carryTranslation = notesLeft.filter(x => x.data.kind === "translation");
    carryNotes = groupByCommentator(notesLeft);
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
