/**
 * Table-driven tests for `groupSections`, the section-merging loop pulled out of `Page`
 * (testability suggestion #5 in FrontendTestabilitySuggestions.md). This is the highest-branching
 * logic in the render tree, and merged-segment bugs live here — these tests exercise it directly
 * with plain data rather than only through rendering and reading the DOM back (as
 * `Page.test.tsx`'s "segment merging"/"separators" suites already do, and continue to).
 */
import {groupSections} from "../Page";
import {resetFixtureCounter, segment} from "./testing/fixtures";

beforeEach(resetFixtureCounter);

function group(sections: Parameters<typeof segment>[0][], compactLayout = false) {
  return groupSections(sections.map(x => segment(x)), {compactLayout, expandedUuids: {}});
}

describe("merging", () => {
  test("segments are separate by default", () => {
    const groups = group([{}, {}, {}]);

    expect(groups.map(g => g.sections.length)).toEqual([1, 1, 1]);
  });

  test("defaultMergeWithNext joins a run of segments", () => {
    const groups = group([{defaultMergeWithNext: true}, {defaultMergeWithNext: true}, {}]);

    expect(groups.map(g => g.sections.length)).toEqual([3]);
  });

  test("a segment that does not merge ends the run", () => {
    const groups = group([{defaultMergeWithNext: true}, {}, {defaultMergeWithNext: true}, {}]);

    expect(groups.map(g => g.sections.length)).toEqual([2, 2]);
  });

  test("compact layout merges everything, regardless of defaultMergeWithNext", () => {
    const groups = group([{}, {}, {}], /* compactLayout */ true);

    expect(groups.map(g => g.sections.length)).toEqual([3]);
  });

  test("lastSegmentOfSection ends a run even in compact layout", () => {
    const groups = group([{lastSegmentOfSection: true}, {}, {}], /* compactLayout */ true);

    expect(groups.map(g => g.sections.length)).toEqual([1, 2]);
  });

  test("lastSegmentOfSection ends a run even with defaultMergeWithNext set on it", () => {
    const groups = group([
      {defaultMergeWithNext: true, lastSegmentOfSection: true},
      {defaultMergeWithNext: true},
      {},
    ]);

    expect(groups.map(g => g.sections.length)).toEqual([1, 2]);
  });

  test("a start-of-sugya segment starts a new run", () => {
    const groups = group([
      {defaultMergeWithNext: true},
      {defaultMergeWithNext: true, steinsaltz_start_of_sugya: true},
      {},
    ]);

    expect(groups.map(g => g.sections.length)).toEqual([1, 2]);
  });

  test("a hadran segment starts a new run", () => {
    const groups = group([
      {defaultMergeWithNext: true},
      {defaultMergeWithNext: true, hadran: true},
      {},
    ]);

    expect(groups.map(g => g.sections.length)).toEqual([1, 2]);
  });

  test('a ref starting with "Hadran " starts a new run', () => {
    const groups = group([
      {defaultMergeWithNext: true},
      {defaultMergeWithNext: true, ref: "Hadran 2"},
      {},
    ]);

    expect(groups.map(g => g.sections.length)).toEqual([1, 2]);
  });

  test("a manually-expanded segment does not continue merging into the next one", () => {
    const overrides: Parameters<typeof segment>[0][] = (
      [{defaultMergeWithNext: true}, {defaultMergeWithNext: true}, {}]);
    const sections = overrides.map(x => segment(x));
    const groups = groupSections(sections, {
      compactLayout: false,
      expandedUuids: {[sections[0].uuid]: true},
    });

    expect(groups.map(g => g.sections.length)).toEqual([1, 2]);
  });

  test("expanding the middle of a run splits it into three, not two", () => {
    // Expanding a uuid breaks merging on both sides of it: the section before it won't merge
    // into it (checked via `nextSection`), and it won't merge into the section after it either
    // (checked via `currentSection`, once it becomes the start of its own run) — so it ends up
    // isolated in the middle rather than joined to either neighbor.
    const overrides: Parameters<typeof segment>[0][] = (
      [{defaultMergeWithNext: true}, {defaultMergeWithNext: true}, {}]);
    const sections = overrides.map(x => segment(x));
    const groups = groupSections(sections, {
      compactLayout: false,
      expandedUuids: {[sections[1].uuid]: true},
    });

    expect(groups.map(g => g.sections.length)).toEqual([1, 1, 1]);
  });

  test("startIndex tracks position in the original array across merged runs", () => {
    const groups = group([{defaultMergeWithNext: true}, {}, {defaultMergeWithNext: true}, {}]);

    expect(groups.map(g => g.startIndex)).toEqual([0, 2]);
  });

  test("an empty page has no groups", () => {
    expect(group([])).toEqual([]);
  });
});

describe("separators", () => {
  test("a separator is drawn before a start-of-sugya segment", () => {
    const groups = group([{}, {steinsaltz_start_of_sugya: true}]);

    expect(groups.map(g => g.separatorBefore)).toEqual([false, true]);
  });

  test("no separator before the very first segment, even if it qualifies", () => {
    const groups = group([{steinsaltz_start_of_sugya: true}, {}]);

    expect(groups.map(g => g.separatorBefore)).toEqual([false, false]);
  });

  test("a separator is drawn before a hadran", () => {
    const groups = group([{}, {hadran: true}]);

    expect(groups.map(g => g.separatorBefore)).toEqual([false, true]);
  });

  test('a separator is drawn before "Hadran 1" specifically', () => {
    const groups = group([{}, {ref: "Hadran 1"}]);

    expect(groups.map(g => g.separatorBefore)).toEqual([false, true]);
  });

  test("a separator is drawn after the last segment of a section", () => {
    const groups = group([{lastSegmentOfSection: true}, {}]);

    expect(groups.map(g => g.separatorAfter)).toEqual([true, false]);
  });

  test("no trailing separator after the final segment of the page", () => {
    const groups = group([{}, {lastSegmentOfSection: true}]);

    expect(groups.map(g => g.separatorAfter)).toEqual([false, false]);
  });
});
