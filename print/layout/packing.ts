// Packing measured content into columns. Pure arithmetic over line boxes — no DOM access — so
// that the paginators can cheaply try many candidate layouts (e.g. "what if this page had one
// more verse?").

import {LineBox} from "./measure";

/** A splittable run of lines, abstracted from MeasuredBlock so this module is DOM-free. */
export interface Lines {
  lines: LineBox[];
}

export interface PackOptions {
  // Minimum lines to leave at the bottom of a column (orphans) and to carry to the next
  // (widows) when splitting a block.
  orphans: number;
  widows: number;
}

export const DEFAULT_PACK_OPTIONS: PackOptions = {orphans: 2, widows: 2};

export function linesHeight(block: Lines, from: number, to: number): number {
  if (to <= from) return 0;
  const top = from === 0 ? 0 : block.lines[from - 1].bottom;
  return block.lines[to - 1].bottom - top;
}

/**
 * Largest `to` (from < to <= lines.length) such that lines [from, to) fit in `height`, or `from`.
 */
export function maxLinesFitting(block: Lines, from: number, height: number): number {
  const top = from === 0 ? 0 : block.lines[from - 1].bottom;
  let lo = from;
  let hi = block.lines.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (block.lines[mid - 1].bottom - top <= height + 0.5) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * A unit of flowing content in a stream (a paragraph, a comment, a heading…).
 */
export interface FlowItem<T = unknown> {
  block: Lines;
  // Vertical space above the item. Suppressed at the top of a column.
  spaceBefore: number;
  // Keep at least the first lines of the next item in the same column as this one.
  keepWithNext?: boolean;
  // Never split this item across columns.
  unsplittable?: boolean;
  data: T;
}

export interface Cursor {
  item: number;
  line: number;
}

export const START: Cursor = {item: 0, line: 0};

export function cursorDone<T>(items: FlowItem<T>[], cursor: Cursor): boolean {
  return cursor.item >= items.length;
}

export function compareCursors(a: Cursor, b: Cursor): number {
  return a.item !== b.item ? a.item - b.item : a.line - b.line;
}

export interface PlacedFragment<T = unknown> {
  item: FlowItem<T>;
  itemIndex: number;
  fromLine: number;
  toLine: number;
  // Space above the fragment within the column (0 at the top of a column).
  spaceBefore: number;
  height: number;
  isFirst: boolean;
  isLast: boolean;
}

export interface ColumnResult<T = unknown> {
  fragments: PlacedFragment<T>[];
  height: number;
  end: Cursor;
}

/**
 * Fills one column of the given height starting at `start`. Always makes progress if the column is
 * empty (an oversize first line is placed anyway) unless `allowEmpty` is set.
 */
export function fillColumn<T>(
  items: FlowItem<T>[],
  start: Cursor,
  height: number,
  options: PackOptions = DEFAULT_PACK_OPTIONS,
  allowEmpty = false,
): ColumnResult<T> {
  const fragments: PlacedFragment<T>[] = [];
  let used = 0;
  let cursor = {...start};

  while (cursor.item < items.length) {
    const item = items[cursor.item];
    const totalLines = item.block.lines.length;
    const empty = fragments.length === 0;
    const space = empty || cursor.line > 0 ? 0 : item.spaceBefore;
    const available = height - used - space;
    const rest = linesHeight(item.block, cursor.line, totalLines);

    if (rest <= available + 0.5) {
      fragments.push({
        item,
        itemIndex: cursor.item,
        fromLine: cursor.line,
        toLine: totalLines,
        spaceBefore: space,
        height: rest,
        isFirst: cursor.line === 0,
        isLast: true,
      });
      used += space + rest;
      cursor = {item: cursor.item + 1, line: 0};
      continue;
    }

    // Doesn't fit entirely: split, or move on.
    let to = item.unsplittable ? cursor.line : maxLinesFitting(item.block, cursor.line, available);
    if (!item.unsplittable) {
      const remainingLines = totalLines - cursor.line;
      // Orphans: don't start an item with fewer than `orphans` lines at the bottom of a column.
      if (cursor.line === 0 && to - cursor.line < Math.min(options.orphans, remainingLines)) {
        to = cursor.line;
      }
      // Widows: don't leave fewer than `widows` lines for the next column.
      if (to > cursor.line && totalLines - to < options.widows) {
        to = Math.max(cursor.line, totalLines - options.widows);
        if (cursor.line === 0 && to < options.orphans) to = cursor.line;
      }
    }

    if (to === cursor.line && empty && !allowEmpty) {
      // Nothing fits in an empty column: force progress so pagination always terminates.
      to = item.unsplittable
        ? totalLines
        : Math.max(cursor.line + 1, maxLinesFitting(item.block, cursor.line, available));
    }

    if (to > cursor.line) {
      const fragmentHeight = linesHeight(item.block, cursor.line, to);
      fragments.push({
        item,
        itemIndex: cursor.item,
        fromLine: cursor.line,
        toLine: to,
        spaceBefore: space,
        height: fragmentHeight,
        isFirst: cursor.line === 0,
        isLast: to === totalLines,
      });
      used += space + fragmentHeight;
      cursor = to === totalLines ? {item: cursor.item + 1, line: 0} : {item: cursor.item, line: to};
    }
    break;
  }

  // keep-with-next: if the column ends right after a keepWithNext item (i.e. the next item didn't
  // start in this column), push that item to the next column as well, unless it's alone in a
  // column that must make progress.
  while (fragments.length > (allowEmpty ? 0 : 1)) {
    const last = fragments[fragments.length - 1];
    const nextNotStarted = cursor.item < items.length && cursor.line === 0;
    if (!(last.isLast && last.item.keepWithNext && nextNotStarted)) {
      break;
    }
    if (!last.isFirst) break;
    fragments.pop();
    used -= last.spaceBefore + last.height;
    cursor = {item: last.itemIndex, line: last.fromLine};
  }

  return {fragments, height: used, end: cursor};
}

export interface ColumnsResult<T = unknown> {
  columns: ColumnResult<T>[];
  // Height of the tallest column.
  height: number;
  end: Cursor;
}

/** Greedily fills `count` columns of `height`. */
export function fillColumns<T>(
  items: FlowItem<T>[],
  start: Cursor,
  count: number,
  height: number,
  options: PackOptions = DEFAULT_PACK_OPTIONS,
  allowEmpty = false,
): ColumnsResult<T> {
  const columns: ColumnResult<T>[] = [];
  let cursor = start;
  for (let i = 0; i < count; i++) {
    const column = fillColumn(items, cursor, height, options, allowEmpty || i > 0);
    columns.push(column);
    cursor = column.end;
  }
  return {columns, height: Math.max(0, ...columns.map(x => x.height)), end: cursor};
}

/**
 * Fills `count` columns with at most `maxHeight`, choosing the smallest column height that
 * consumes as much content as `maxHeight` would. This balances partially full regions (e.g. the
 * last page of a chapter, or a commentary that only has a few lines on this page).
 */
export function fillColumnsBalanced<T>(
  items: FlowItem<T>[],
  start: Cursor,
  count: number,
  maxHeight: number,
  options: PackOptions = DEFAULT_PACK_OPTIONS,
  allowEmpty = false,
): ColumnsResult<T> {
  const full = fillColumns(items, start, count, maxHeight, options, allowEmpty);
  if (count === 1 || full.columns.every(x => x.fragments.length === 0)) {
    return full;
  }
  let lo = 0;
  let hi = maxHeight;
  let best = full;
  for (let i = 0; i < 18 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    const attempt = fillColumns(items, start, count, mid, options, true);
    if (compareCursors(attempt.end, full.end) >= 0) {
      best = attempt;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

/** Total height of the remaining content if laid out in a single column (ignoring splits). */
export function remainingHeight<T>(items: FlowItem<T>[], start: Cursor): number {
  let total = 0;
  for (let i = start.item; i < items.length; i++) {
    const item = items[i];
    const from = i === start.item ? start.line : 0;
    total += (i === start.item && from > 0 ? 0 : item.spaceBefore)
      + linesHeight(item.block, from, item.block.lines.length);
  }
  return total;
}

/**
 * The unconsumed tail of an item that was split after `line`, as a new item whose line boxes start
 * at 0. `data.lineOffset` records how many lines of the original block were consumed.
 */
export function rebaseItem<T extends {lineOffset: number}>(
  item: FlowItem<T>,
  line: number,
): FlowItem<T> {
  if (line === 0) return item;
  const base = item.block.lines[line - 1].bottom;
  return {
    ...item,
    spaceBefore: 0,
    block: {
      lines: item.block.lines.slice(line).map(x => ({start: x.start, bottom: x.bottom - base})),
    },
    data: {...item.data, lineOffset: item.data.lineOffset + line},
  };
}

// ---------------------------------------------------------------------------------------------
// Paired lanes: rows of side-by-side blocks (e.g. Hebrew | English) that split across columns
// and pages independently, each lane with its own progress.

export interface PairItem<T = unknown> {
  // One or two lanes (a single lane spans the row, e.g. a heading).
  lanes: (Lines | undefined)[];
  // Per-lane downward shift aligning the lanes' first baselines.
  shifts: number[];
  spaceBefore: number;
  keepWithNext?: boolean;
  unsplittable?: boolean;
  data: T;
}

export interface PairCursor {
  item: number;
  // Lines consumed so far, per lane.
  lines: number[];
}

export interface PlacedPairRow<T = unknown> {
  item: PairItem<T>;
  itemIndex: number;
  from: number[];
  to: number[];
  spaceBefore: number;
  height: number;
  isFirst: boolean;
  isLast: boolean;
}

export interface PairsResult<T = unknown> {
  rows: PlacedPairRow<T>[];
  height: number;
  end: PairCursor;
}

export const PAIR_START: PairCursor = {item: 0, lines: []};

function laneCount(lane: Lines | undefined): number {
  return lane ? lane.lines.length : 0;
}

function pairDone<T>(item: PairItem<T>, lines: number[]): boolean {
  return item.lanes.every((lane, i) => (lines[i] ?? 0) >= laneCount(lane));
}

export function pairsDone<T>(items: PairItem<T>[], cursor: PairCursor): boolean {
  return cursor.item >= items.length;
}

/** Fills one column of the given height with paired rows. */
export function fillPairs<T>(
  items: PairItem<T>[],
  start: PairCursor,
  height: number,
  options: PackOptions = DEFAULT_PACK_OPTIONS,
  allowEmpty = false,
): PairsResult<T> {
  const rows: PlacedPairRow<T>[] = [];
  let used = 0;
  let cursor: PairCursor = {item: start.item, lines: start.lines.slice()};

  while (cursor.item < items.length) {
    const item = items[cursor.item];
    const consumed = cursor.lines;
    const from = item.lanes.map((_, i) => consumed[i] ?? 0);
    const atStart = from.every(x => x === 0);
    const space = rows.length === 0 || !atStart ? 0 : item.spaceBefore;
    const available = height - used - space;
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    const laneRest = (i: number) => {
      const lane = item.lanes[i];
      return lane && from[i] < lane.lines.length
        ? item.shifts[i] + linesHeight(lane, from[i], lane.lines.length)
        : 0;
    };
    const remaining = Math.max(0, ...item.lanes.map((_, i) => laneRest(i)));

    let to: number[];
    if (remaining <= available + 0.5) {
      to = item.lanes.map(laneCount);
    } else if (item.unsplittable) {
      to = rows.length === 0 && !allowEmpty ? item.lanes.map(laneCount) : from.slice();
    } else {
      to = item.lanes.map((lane, i) => {
        if (!lane) return 0;
        const total = lane.lines.length;
        if (from[i] >= total) return total;
        let fit = maxLinesFitting(lane, from[i], available - item.shifts[i]);
        if (from[i] === 0 && fit - from[i] < Math.min(options.orphans, total)) fit = from[i];
        if (fit > from[i] && fit < total && total - fit < options.widows) {
          fit = Math.max(from[i], total - options.widows);
          if (from[i] === 0 && fit < options.orphans) fit = from[i];
        }
        return fit;
      });
      if (to.every((x, i) => x === from[i]) && rows.length === 0 && !allowEmpty) {
        to = item.lanes.map((lane, i) => (lane ? Math.min(lane.lines.length, from[i] + 1) : 0));
      }
    }

    if (!to.some((x, i) => x > from[i])) break;
    const rowHeight = Math.max(0, ...item.lanes.map((lane, i) => (
      lane && to[i] > from[i] ? item.shifts[i] + linesHeight(lane, from[i], to[i]) : 0)));
    const done = pairDone(item, to);
    rows.push({
      item,
      itemIndex: cursor.item,
      from,
      to,
      spaceBefore: space,
      height: rowHeight,
      isFirst: atStart,
      isLast: done,
    });
    used += space + rowHeight;
    if (!done) {
      cursor = {item: cursor.item, lines: to};
      break;
    }
    cursor = {item: cursor.item + 1, lines: []};
  }

  // keep-with-next, as in fillColumn.
  while (rows.length > 1 && cursor.item < items.length && cursor.lines.length === 0) {
    const last = rows[rows.length - 1];
    if (!(last.isLast && last.isFirst && last.item.keepWithNext)) break;
    rows.pop();
    used -= last.spaceBefore + last.height;
    cursor = {item: last.itemIndex, lines: []};
  }

  return {rows, height: used, end: cursor};
}

/** The unconsumed tail of a pair item, with each lane rebased. */
export function rebasePair<T extends {lineOffsets: number[]}>(
  item: PairItem<T>,
  lines: number[],
): PairItem<T> {
  if (lines.every(x => !x)) return item;
  return {
    ...item,
    spaceBefore: 0,
    lanes: item.lanes.map((lane, i) => {
      const line = lines[i] ?? 0;
      if (!lane || line === 0) return lane;
      const base = lane.lines[line - 1].bottom;
      return {lines: lane.lines.slice(line).map(x => ({start: x.start, bottom: x.bottom - base}))};
    }),
    data: {...item.data, lineOffsets: item.data.lineOffsets.map((x, i) => x + (lines[i] ?? 0))},
  };
}

export function pairsRemainingHeight<T>(items: PairItem<T>[], start: PairCursor): number {
  let total = 0;
  for (let i = start.item; i < items.length; i++) {
    const item = items[i];
    const lines = i === start.item ? start.lines : [];
    const atStart = lines.every(x => !x);
    total += (atStart ? item.spaceBefore : 0) + Math.max(0, ...item.lanes.map((lane, l) => (
      lane ? item.shifts[l] + linesHeight(lane, lines[l] ?? 0, lane.lines.length) : 0)));
  }
  return total;
}
