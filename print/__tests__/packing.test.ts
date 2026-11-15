import {
  FlowItem,
  START,
  fillColumn,
  fillColumns,
  fillColumnsBalanced,
  maxLinesFitting,
  PAIR_START,
  fillPairs,
  rebasePair,
} from "../layout/packing";

function block(lineCount: number, lineHeight = 10) {
  const lines = Array.from(
    {length: lineCount}, (_, i) => ({start: i, bottom: (i + 1) * lineHeight}));
  return {lines};
}

function item(lineCount: number, extra: Partial<FlowItem<string>> = {}): FlowItem<string> {
  return {block: block(lineCount), spaceBefore: 5, data: "", ...extra};
}

describe("packing", () => {
  test("maxLinesFitting", () => {
    expect(maxLinesFitting(block(10), 0, 35)).toBe(3);
    expect(maxLinesFitting(block(10), 3, 35)).toBe(6);
    expect(maxLinesFitting(block(10), 0, 5)).toBe(0);
    expect(maxLinesFitting(block(10), 0, 1000)).toBe(10);
  });

  test("fills whole items, applying spaceBefore except at the top", () => {
    const result = fillColumn([item(3), item(3), item(3)], START, 100);
    expect(result.fragments.map(x => x.spaceBefore)).toEqual([0, 5, 5]);
    expect(result.height).toBe(100);
    expect(result.end).toEqual({item: 3, line: 0});
  });

  test("splits with widow/orphan control", () => {
    // 5 lines available for a 6 line item -> would leave 1 widow, so take 4.
    const result = fillColumn([item(6)], START, 50);
    expect(result.fragments[0].toLine).toBe(4);
    expect(result.end).toEqual({item: 0, line: 4});
  });

  test("doesn't start an item with a single orphan line", () => {
    const result = fillColumn([item(2), item(5)], START, 38);
    expect(result.fragments.length).toBe(1);
    expect(result.end).toEqual({item: 1, line: 0});
  });

  test("keepWithNext moves a heading to the next column", () => {
    const items = [item(5), item(1, {keepWithNext: true}), item(5)];
    const result = fillColumn(items, START, 70);
    expect(result.fragments.length).toBe(1);
    expect(result.end).toEqual({item: 1, line: 0});
  });

  test("forces progress in an empty column", () => {
    const result = fillColumn([item(1, {unsplittable: true, block: block(1, 500)})], START, 100);
    expect(result.end).toEqual({item: 1, line: 0});
  });

  test("columns continue where the previous one ended", () => {
    const result = fillColumns([item(10)], START, 2, 60);
    const ranges = result.columns.map(x => [x.fragments[0].fromLine, x.fragments[0].toLine]);
    expect(ranges).toEqual([[0, 6], [6, 10]]);
  });

  test("balanced columns", () => {
    const result = fillColumnsBalanced([item(10)], START, 2, 200);
    expect(result.columns.map(x => x.height)).toEqual([50, 50]);
    expect(result.end).toEqual({item: 1, line: 0});
  });
});

describe("pairs", () => {
  const pair = (a: number, b: number, extra = {}) => ({
    lanes: [block(a), block(b)],
    shifts: [0, 0],
    spaceBefore: 5,
    data: {lineOffsets: [0, 0]},
    ...extra,
  });

  test("rows take the taller lane's height", () => {
    const result = fillPairs([pair(2, 4), pair(1, 1)], PAIR_START, 1000);
    expect(result.rows.map(x => x.height)).toEqual([40, 10]);
    expect(result.height).toBe(55);
  });

  test("lanes split independently with widow/orphan control", () => {
    const result = fillPairs([pair(3, 8)], PAIR_START, 50);
    expect(result.rows[0].to).toEqual([3, 5]);
    expect(result.end).toEqual({item: 0, lines: [3, 5]});
    const next = fillPairs([pair(3, 8)], result.end, 100);
    expect(next.rows[0].from).toEqual([3, 5]);
    expect(next.end).toEqual({item: 1, lines: []});
  });

  test("shifts count toward the row height", () => {
    const result = fillPairs([{...pair(1, 1), shifts: [0, 3]}], PAIR_START, 100);
    expect(result.rows[0].height).toBe(13);
  });

  test("rebasePair", () => {
    const rebased = rebasePair(pair(3, 8), [3, 5]);
    expect(rebased.lanes[1]!.lines.map(x => x.bottom)).toEqual([10, 20, 30]);
    expect(rebased.data.lineOffsets).toEqual([3, 5]);
  });
});

describe("keep-with-next in optional columns", () => {
  test("a heading alone at the end of an optional column moves on", () => {
    const items = [item(1, {keepWithNext: true, unsplittable: true}), item(5)];
    expect(fillColumn(items, START, 15, undefined, true).fragments).toEqual([]);
    // In a column that must make progress, the heading stays.
    expect(fillColumn(items, START, 15).fragments.length).toBe(1);
  });
});
