// Siddur pagination: a single column of rows. A row is either one block (Hebrew only, Hebrew with
// footnoted English, a section title, or one half of a stacked row) or a side-by-side pair of
// blocks (Hebrew on the right, English on the left) that are split across pages independently.
// English footnotes and commentary are set in a notes area at the bottom of the page.

// The pagination loop's closures are synchronous; capturing loop state in them is intended.
/* eslint-disable @typescript-eslint/no-loop-func */

import {SiddurDocument} from "../model/documents";
import {fontFamily, mixedFontFamily} from "../model/fonts";
import {pageBox} from "../model/geometry";
import {SiddurRow, SiddurUnit} from "../model/siddurModel";
import {Token, sanitizeCss, tokenize} from "../model/richText";
import {
  BlockSpec,
  MeasuredBlock,
  blockInnerHtml,
  measureBlocks,
  measureHtmlHeight,
  setMeasurementContext,
} from "./measure";
import {
  DEFAULT_PACK_OPTIONS,
  FlowItem,
  START,
  cursorDone,
  fillColumn,
  linesHeight,
  maxLinesFitting,
  rebaseItem,
  remainingHeight,
} from "./packing";

const PT = 96 / 72;

export function usesLineGrid(doc: SiddurDocument): boolean {
  return doc.spread === "facing" || Boolean(doc.typography.lineGrid);
}

export function siddurCssVars(doc: SiddurDocument): string {
  const t = doc.typography;
  return [
    `--he-font: ${fontFamily(t.hebrewFont)}`,
    `--en-font: ${mixedFontFamily(t.englishFont, t.hebrewFont)}`,
    `--he-size: ${t.hebrewSizePt}pt`,
    `--en-size: ${t.englishSizePt}pt`,
    `--lh: ${t.lineHeight}`,
    // On a shared baseline grid, English lines use the Hebrew line pitch so they line up.
    `--en-lh: ${usesLineGrid(doc) ? `${t.hebrewSizePt * t.lineHeight}pt` : "1.42"}`,
    `--instruction-color: ${t.instructionColor}`,
    `--accent: ${t.accentColor}`,
  ].join("; ");
}

export interface SdFragment {
  // Pushes the fragment down so its first baseline lines up with its partner lane's.
  offset?: number;
  key: string;
  lang?: string;
  className: string;
  style?: string;
  dir: "rtl" | "ltr";
  html: string;
  height: number;
}

export interface SdPlacedRow {
  key: string;
  spaceBefore: number;
  height: number;
  // One fragment for single rows; [hebrew, english] for pairs (either may be empty).
  lanes: (SdFragment | undefined)[];
  pair: boolean;
  pieces: string[];
}

export interface SdPage {
  index: number;
  headerHebrew: string;
  headerEnglish: string;
  rows: SdPlacedRow[];
  notes: SdFragment[];
  notesHeight: number;
}

export interface SiddurLayout {
  pages: SdPage[];
  // Facing mode: each SdPage is a spread, rendered as a Hebrew page and an English page.
  facing: boolean;
  cssVars: string;
  geometry: {
    widthPx: number;
    heightPx: number;
    contentWidth: number;
    hebrewWidth: number;
    englishWidth: number;
    gap: number;
    headerHeight: number;
    headerGap: number;
    footerHeight: number;
    footerGap: number;
    notesRuleHeight: number;
  };
  marginsFor: (pageIndex: number) => {top: number; bottom: number; left: number; right: number};
  stats: {rows: number; millis: number};
}

interface Item {
  // Per-lane downward shift aligning the lanes' first baselines.
  shifts: number[];
  key: string;
  lanes: (MeasuredBlock | undefined)[];
  pair: boolean;
  spaceBefore: number;
  keepWithNext: boolean;
  pageBreakBefore: boolean;
  unsplittable: boolean;
  notes: MeasuredBlock[];
  sectionId: string;
  pieces: string[];
}

interface NoteData {
  measured: MeasuredBlock;
  lineOffset: number;
}

function defaultSpaceBefore(row: SiddurRow, lineHeight: number): number {
  if (row.paragraphStart) return 0.55 * lineHeight;
  return row.options.lineMode === "lines" ? 0 : 0.2 * lineHeight;
}

function hasHebrew(row: SiddurRow): boolean {
  return row.he.some(x => x.kind === "word" && x.html.replace(/<[^>]*>/g, "").trim().length > 0);
}

function lineMark(token: Token | undefined): string | undefined {
  return token?.marks.find(x => x.attrs.includes("sd-line"))?.attrs;
}

function sameLine(a: Token | undefined, b: Token | undefined): boolean {
  const mark = lineMark(a);
  return mark !== undefined && mark === lineMark(b);
}

function alignClass(align: string): string {
  return `align-${align}`;
}

function blockStyle(row: SiddurRow, lang: "he" | "en"): string {
  const {options} = row;
  const parts: string[] = [];
  if (options.scale !== 1) {
    parts.push(`font-size: calc(var(--${lang}-size) * ${options.scale})`);
  }
  if (options.indent > 0) {
    if (options.lineMode === "lines") {
      // Hanging indent: each sense line (a .sd-line span) indents only its wrapped continuation.
      parts.push(`--hang: ${options.indent}em`);
    } else {
      parts.push(`padding-inline-start: ${options.indent}em`);
    }
  }
  if (lang === "he" && options.css) parts.push(sanitizeCss(options.css));
  return parts.filter(x => x).join("; ");
}


export function paginateSiddur(doc: SiddurDocument, units: SiddurUnit[]): SiddurLayout {
  const startTime = performance.now();
  const box = pageBox(doc.page);
  const cssVars = siddurCssVars(doc);
  setMeasurementContext("print-root siddur", cssVars);

  const W = box.contentWidthPx;
  const facing = doc.spread === "facing";
  const gap = 16 * PT;
  // In facing mode each language has its own page, so each lane is a full page wide.
  const hebrewWidth = facing ? W : (W - gap) * 0.56;
  const englishWidth = facing ? W : W - gap - hebrewWidth;
  const heLine = doc.typography.hebrewSizePt * PT * doc.typography.lineHeight;
  const headerGap = 10 * PT;
  const footerGap = 8 * PT;
  const notesRuleHeight = 9 * PT;

  const headerHeight = measureHtmlHeight(
    '<div class="sd-head"><span class="he">א</span><span class="en">A</span></div>', "", W);
  const footerHeight = measureHtmlHeight('<div class="sd-foot">1</div>', "", W);
  const bodyHeight = box.contentHeightPx - headerHeight - headerGap - footerHeight - footerGap;
  const notesCap = bodyHeight * 0.4;

  // ---- Build block specs, then measure them in batches by width.
  interface PendingItem {
    key: string;
    specs: (BlockSpec | undefined)[];
    widths: number[];
    pair: boolean;
    spaceBefore: number;
    keepWithNext: boolean;
    pageBreakBefore: boolean;
    unsplittable: boolean;
    noteSpecs: BlockSpec[];
    sectionId: string;
    pieces: string[];
  }
  const pending: PendingItem[] = [];
  const titles = new Map<string, {he: string; en: string}>();

  const heSpec = (row: SiddurRow, key: string, tokens: Token[]): BlockSpec => ({
    key,
    className: `blk sd-he ${alignClass(row.options.align)} ${row.options.lineMode === "lines" ? "lines" : ""}`,
    style: blockStyle(row, "he"),
    dir: "rtl",
    lang: "he",
    tokens,
  });
  const enSpec = (row: SiddurRow, key: string, extraClass = ""): BlockSpec => ({
    key,
    // With no Hebrew beside it there is nothing to line up with: use normal leading.
    className: `blk sd-en ${alignClass(row.options.englishAlign)} ${extraClass}${hasHebrew(row) ? "" : " solo"}`,
    style: blockStyle(row, "en"),
    dir: "ltr",
    lang: "en",
    tokens: row.en,
  });

  for (const unit of units) {
    if (unit.kind === "title") {
      titles.set(unit.sectionId, {he: unit.he, en: unit.en});
      const specs: BlockSpec[] = facing
        ? [
          {key: `${unit.key}:he`, className: "blk sd-title", dir: "rtl", tokens: tokenize(`<span class="he">${unit.he}</span>`)},
          {key: `${unit.key}:en`, className: "blk sd-title", dir: "ltr", tokens: tokenize(`<span class="en">${unit.en}</span>`)},
        ]
        : [{
          key: unit.key,
          className: "blk sd-title",
          dir: "rtl",
          tokens: tokenize(`<span class="he">${unit.he}</span><br><span class="en">${unit.en}</span>`),
        }];
      pending.push({
        key: unit.key,
        specs,
        widths: facing ? [W, W] : [W],
        pair: facing,
        spaceBefore: 2.2 * heLine,
        keepWithNext: true,
        pageBreakBefore: unit.pageBreakBefore,
        unsplittable: true,
        noteSpecs: [],
        sectionId: unit.sectionId,
        pieces: [],
      });
      continue;
    }

    const row = unit;
    const spaceBefore = row.options.spaceBefore !== undefined
      ? row.options.spaceBefore * heLine
      : defaultSpaceBefore(row, heLine);
    const noteSpecs: BlockSpec[] = row.notes.map((note, n) => ({
      key: `${row.key}:note:${n}`,
      className: `blk sd-note ${note.kind}`,
      dir: "ltr",
      lang: "en",
      tokens: tokenize(note.kind === "translation"
        ? `<sup>${note.marker}</sup> ${note.html}`
        : `<span class="sd-note-type">${note.type === "Koren Sacks Commentary" ? "Commentary" : note.type}</span> ${note.html}`),
    }));
    const common = {
      pageBreakBefore: row.options.pageBreakBefore,
      unsplittable: false,
      sectionId: row.sectionId,
      pieces: row.pieces,
    };

    if (facing) {
      // Every row is a pair: Hebrew on its page, English (if any) at the same height on the other.
      const hasEnglish = row.en.length > 0 && row.translation !== "hebrew-only";
      pending.push({
        ...common,
        key: row.key,
        specs: [heSpec(row, `${row.key}:he`, row.he), hasEnglish ? enSpec(row, `${row.key}:en`) : undefined],
        widths: [W, W],
        pair: true,
        spaceBefore,
        keepWithNext: row.options.keepWithNext,
        noteSpecs,
      });
    } else if (row.translation === "side-by-side") {
      pending.push({
        ...common,
        key: row.key,
        specs: [heSpec(row, `${row.key}:he`, row.he), row.en.length > 0 ? enSpec(row, `${row.key}:en`) : undefined],
        widths: [hebrewWidth, englishWidth],
        pair: true,
        spaceBefore,
        keepWithNext: row.options.keepWithNext,
        noteSpecs,
      });
    } else if (row.translation === "stacked" && row.en.length > 0) {
      pending.push({
        ...common,
        key: `${row.key}:he`,
        specs: [heSpec(row, `${row.key}:he`, row.he)],
        widths: [W],
        pair: false,
        spaceBefore,
        keepWithNext: true,
        noteSpecs,
      });
      pending.push({
        ...common,
        pageBreakBefore: false,
        key: `${row.key}:en`,
        specs: [enSpec(row, `${row.key}:en`, "stacked")],
        widths: [W],
        pair: false,
        spaceBefore: 0.15 * heLine,
        keepWithNext: row.options.keepWithNext,
        noteSpecs: [],
      });
    } else {
      pending.push({
        ...common,
        key: row.key,
        specs: [heSpec(row, `${row.key}:he`, row.he)],
        widths: [W],
        pair: false,
        spaceBefore,
        keepWithNext: row.options.keepWithNext,
        noteSpecs,
      });
    }
  }

  // Batch measurement per distinct width.
  const byWidth = new Map<number, BlockSpec[]>();
  const addSpec = (spec: BlockSpec | undefined, width: number) => {
    if (!spec) return;
    if (!byWidth.has(width)) byWidth.set(width, []);
    byWidth.get(width)!.push(spec);
  };
  for (const item of pending) {
    item.specs.forEach((spec, i) => addSpec(spec, item.widths[i]));
    item.noteSpecs.forEach(spec => addSpec(spec, W));
  }
  for (const [width, specs] of byWidth) measureBlocks(specs, width);
  const measure = (spec: BlockSpec, width: number) => measureBlocks([spec], width)[0];

  const items: Item[] = pending.map(x => ({
    key: x.key,
    lanes: x.specs.map((spec, i) => (spec ? measure(spec, x.widths[i]) : undefined)),
    shifts: [],
    pair: x.pair,
    spaceBefore: x.spaceBefore,
    keepWithNext: x.keepWithNext,
    pageBreakBefore: x.pageBreakBefore,
    unsplittable: x.unsplittable,
    notes: x.noteSpecs.map(spec => measure(spec, W)),
    sectionId: x.sectionId,
    pieces: x.pieces,
  }));
  for (const item of items) {
    const present = item.lanes.filter((x): x is MeasuredBlock => x !== undefined);
    const top = Math.max(0, ...present.map(x => x.baseline));
    item.shifts = item.lanes.map(lane => (item.pair && lane ? top - lane.baseline : 0));
  }

  // ---- Pagination
  const noteItem = (measured: MeasuredBlock): FlowItem<NoteData> => ({
    block: measured,
    spaceBefore: 0.25 * doc.typography.englishSizePt * PT,
    data: {measured, lineOffset: 0},
  });

  const renderFragment = (
    measured: MeasuredBlock,
    from: number,
    to: number,
    key: string,
    height: number,
  ): SdFragment => {
    const {spec, lines} = measured;
    const {start} = lines[from];
    const end = to < lines.length ? lines[to].start : spec.tokens.length;
    const classes = [spec.className];
    if (from > 0) classes.push("cont");
    // Starting in the middle of a sense line: its first (partial) line isn't outdented.
    if (from > 0 && start > 0 && sameLine(spec.tokens[start - 1], spec.tokens[start])) {
      classes.push("cont-mid");
    }

    return {
      key,
      className: classes.join(" "),
      style: spec.style,
      dir: spec.dir,
      lang: spec.lang,
      // Only justified blocks keep a continued fragment's last line justified.
      html: blockInnerHtml(
        spec, start, end, false,
        to < lines.length && spec.className.includes("align-justify") ? lines[to - 1].start : undefined),
      height,
    };
  };

  const laneLines = (lane: MeasuredBlock | undefined) => (lane ? lane.lines.length : 0);
  const itemDone = (item: Item, offsets: number[]) => (
    item.lanes.every((lane, i) => offsets[i] >= laneLines(lane)));

  const pages: SdPage[] = [];
  let index = 0;
  let offsets: number[] = [];
  let carryNotes: FlowItem<NoteData>[] = [];
  let lastSection = items[0]?.sectionId ?? "";

  while ((index < items.length || carryNotes.length > 0) && pages.length < 5000) {
    const rows: SdPlacedRow[] = [];
    const rowItems: {item: Item; startedHere: boolean}[] = [];
    let used = 0;
    let pageSection: string | undefined;

    const notesFor = (extra: MeasuredBlock[]): FlowItem<NoteData>[] => [
      ...carryNotes,
      ...rowItems.filter(x => x.startedHere).flatMap(x => x.item.notes.map(noteItem)),
      ...extra.map(noteItem),
    ];
    const notesHeight = (notes: FlowItem<NoteData>[]) => {
      if (notes.length === 0) return 0;
      return Math.min(notesCap, remainingHeight(notes, START)) + notesRuleHeight;
    };

    while (index < items.length) {
      const item = items[index];
      if (offsets.length === 0) offsets = item.lanes.map(() => 0);
      const atStart = offsets.every(x => x === 0);
      if (item.pageBreakBefore && atStart && rows.length > 0) break;

      const space = rows.length === 0 || !atStart ? 0 : item.spaceBefore;
      const newNotes = atStart ? item.notes : [];
      const available = bodyHeight - used - space - notesHeight(notesFor(newNotes));

      const remaining = Math.max(0, ...item.lanes.map((lane, i) => (
        lane && offsets[i] < lane.lines.length
          ? item.shifts[i] + linesHeight(lane, offsets[i], lane.lines.length)
          : 0)));

      let targets: number[];
      if (remaining <= available + 0.5) {
        targets = item.lanes.map(lane => laneLines(lane));
      } else if (item.unsplittable) {
        targets = rows.length === 0 ? item.lanes.map(lane => laneLines(lane)) : offsets.slice();
      } else {
        targets = item.lanes.map((lane, i) => {
          if (!lane) return 0;
          const from = offsets[i];
          const total = lane.lines.length;
          if (from >= total) return total;
          let to = maxLinesFitting(lane, from, available - item.shifts[i]);
          const {orphans, widows} = DEFAULT_PACK_OPTIONS;
          if (from === 0 && to - from < Math.min(orphans, total)) to = from;
          if (to > from && to < total && total - to < widows) {
            to = Math.max(from, total - widows);
            if (from === 0 && to < orphans) to = from;
          }
          return to;
        });
        if (targets.every((to, i) => to === offsets[i]) && rows.length === 0) {
          // Nothing fits on an empty page: force a line per lane so we always make progress.
          targets = item.lanes.map((lane, i) => (
            lane ? Math.min(lane.lines.length, offsets[i] + 1) : 0));
        }
      }

      const progressed = targets.some((to, i) => to > offsets[i]);
      if ((window as any).__PRINT_DEBUG__) {
        // eslint-disable-next-line no-console
        console.log("siddur", pages.length, item.key, {used, space, available, remaining, targets, offsets});
      }
      if (!progressed) break;

      const laneHeights = item.lanes.map((lane, i) => (
        lane ? linesHeight(lane, offsets[i], targets[i]) : 0));
      const height = Math.max(0, ...laneHeights.map((h, i) => (h > 0 ? h + item.shifts[i] : 0)));
      rows.push({
        key: `${item.key}@${offsets.join(",")}`,
        spaceBefore: space,
        height,
        pair: item.pair,
        pieces: item.pieces,
        lanes: item.lanes.map((lane, i) => (lane && targets[i] > offsets[i]
          ? {
            ...renderFragment(lane, offsets[i], targets[i], `${item.key}:${i}:${offsets[i]}`, laneHeights[i]),
            offset: item.shifts[i],
          }
          : undefined)),
      });
      rowItems.push({item, startedHere: atStart});
      used += space + height;
      pageSection = pageSection ?? item.sectionId;

      if (itemDone(item, targets)) {
        index++;
        offsets = [];
      } else {
        offsets = targets;
        break;
      }
    }

    // keep-with-next: don't end a page with a title (or another keepWithNext row) when the next
    // row didn't start on this page.
    while (rows.length > 1 && offsets.length === 0 && index < items.length) {
      const last = rowItems[rowItems.length - 1];
      if (!last.item.keepWithNext || !last.startedHere) break;
      rows.pop();
      rowItems.pop();
      index--;
      offsets = [];
    }

    // Notes.
    const notes = notesFor([]);
    let noteFragments: SdFragment[] = [];
    let notesUsed = 0;
    if (notes.length > 0) {
      const reserved = Math.max(0, Math.min(notesCap, bodyHeight - used - notesRuleHeight));
      const result = fillColumn(notes, START, reserved, DEFAULT_PACK_OPTIONS, rows.length > 0);
      noteFragments = result.fragments.map((fragment, f) => {
        const {measured, lineOffset} = fragment.item.data;
        return renderFragment(
          measured,
          lineOffset + fragment.fromLine,
          lineOffset + fragment.toLine,
          `${pages.length}:note:${f}`,
          fragment.height);
      }).map((x, f) => ({...x, style: `${x.style ?? ""}; margin-top: ${result.fragments[f].spaceBefore}px`}));
      notesUsed = result.height;
      carryNotes = cursorDone(notes, result.end) ? [] : [
        rebaseItem(notes[result.end.item], result.end.line),
        ...notes.slice(result.end.item + 1),
      ];
    } else {
      carryNotes = [];
    }

    const section = pageSection ?? lastSection;
    lastSection = section;
    const title = titles.get(section) ?? {he: "", en: ""};
    pages.push({
      index: pages.length,
      headerHebrew: title.he,
      headerEnglish: title.en,
      rows,
      notes: noteFragments,
      notesHeight: notesUsed,
    });
  }

  return {
    pages,
    facing,
    cssVars,
    geometry: {
      widthPx: box.widthPx,
      heightPx: box.heightPx,
      contentWidth: W,
      hebrewWidth,
      englishWidth,
      gap,
      headerHeight,
      headerGap,
      footerHeight,
      footerGap,
      notesRuleHeight,
    },
    marginsFor: box.marginsFor,
    stats: {rows: items.length, millis: Math.round(performance.now() - startTime)},
  };
}
