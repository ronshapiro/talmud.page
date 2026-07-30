import * as React from "react";
import {Segment, UiSegment} from "../Segment";
import {TestConfiguration, TestContext} from "./testing/configuration";
import {
  classesOf,
  doubleClick,
  mount,
  query,
  queryAll,
  queryOrNull,
  texts,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";
import {commentaries, resetFixtureCounter, segment} from "./testing/fixtures";

beforeEach(() => {
  installPageEnvironment();
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

const SEGMENT_LABEL = "2a_section_1";

interface RenderOptions {
  toggleMerging?: (uuid: string) => void;
  isExpanded?: boolean;
  lastUnexpandedUuid?: string;
  context?: Partial<TestConfiguration>;
}

function render(segments: UiSegment[], options: RenderOptions = {}): HTMLElement {
  return mount(
    <TestContext overrides={options.context ?? {}}>
      <Segment
        segments={segments}
        segmentLabel={SEGMENT_LABEL}
        toggleMerging={options.toggleMerging ?? (() => {})}
        isExpanded={options.isExpanded ?? false}
        lastUnexpandedUuid={options.lastUnexpandedUuid}
        />
    </TestContext>,
  );
}

const gemaraRow = (root: HTMLElement) => query(root, ".gemara-container");
const gemaraHebrew = (root: HTMLElement) => query(gemaraRow(root), ".table-cell.hebrew");
const gemaraEnglish = (root: HTMLElement) => queryOrNull(gemaraRow(root), ".table-cell.english");

describe("container", () => {
  test("is labelled and carries the segment ref", () => {
    const root = render([segment({ref: "Berakhot 2a:1"})]);

    const container = query(root, ".segment-container");
    expect(container.id).toBe(SEGMENT_LABEL);
    expect(container.getAttribute("sefaria-ref")).toBe("Berakhot 2a:1");
  });

  test("merged segments are addressed by their last ref", () => {
    // The last ref is used so that a note added to a merged segment sorts after everything it
    // contains.
    const root = render([segment({ref: "Berakhot 2a:1"}), segment({ref: "Berakhot 2a:2"})]);

    expect(query(root, ".segment-container").getAttribute("sefaria-ref")).toBe("Berakhot 2a:2");
  });

  test("a hadran segment marks the row", () => {
    const root = render([segment({hadran: true})]);

    expect(classesOf(gemaraRow(root))).toContain("hadran");
  });

  test("merging with a hadran segment marks the whole row", () => {
    const root = render([segment(), segment({hadran: true})]);

    expect(classesOf(gemaraRow(root))).toContain("hadran");
  });
});

describe("text", () => {
  test("renders hebrew and english side by side", () => {
    const root = render([segment({he: "עברית", en: "english"})]);

    expect(gemaraHebrew(root).textContent).toBe("עברית");
    expect(gemaraEnglish(root)!.textContent).toBe("english");
  });

  test("merged segments are joined with a space", () => {
    const root = render([
      segment({he: "ראשון", en: "first"}),
      segment({he: "שני", en: "second"}),
    ]);

    expect(gemaraHebrew(root).textContent).toBe("ראשון שני");
    expect(gemaraEnglish(root)!.textContent).toBe("first second");
  });

  test("each merged part keeps its own ref", () => {
    const root = render([
      segment({ref: "Berakhot 2a:1", he: "ראשון"}),
      segment({ref: "Berakhot 2a:2", he: "שני"}),
    ]);

    const parts = queryAll(gemaraHebrew(root), "span[sefaria-ref]");
    expect(parts.map(x => x.getAttribute("sefaria-ref")))
      .toEqual(["Berakhot 2a:1", "Berakhot 2a:2"]);
  });

  test("english is omitted in side-by-side-less translation modes", () => {
    localStorage.translationOption = "both";
    const root = render([segment({he: "עברית", en: "english"})]);

    expect(gemaraEnglish(root)).toBeNull();
  });
});

describe("merging interactions", () => {
  test("double clicking a part of a merged segment expands it", () => {
    const toggleMerging = jest.fn();
    const first = segment({he: "ראשון"});
    const root = render([first, segment({he: "שני"})], {toggleMerging});

    doubleClick(query(gemaraHebrew(root), "span[sefaria-ref] .hebrew-ref-text"));

    expect(toggleMerging).toHaveBeenCalledWith(first.uuid);
  });

  test("double clicking an unmerged segment does not toggle merging", () => {
    const toggleMerging = jest.fn();
    const root = render([segment({he: "עברית", commentary: commentaries({Rashi: [{}]})})], {
      toggleMerging,
    });

    doubleClick(query(gemaraHebrew(root), ".hebrew-ref-text"));

    expect(toggleMerging).not.toHaveBeenCalled();
  });

  test("an expanded segment offers a close button that re-merges it", () => {
    const toggleMerging = jest.fn();
    const only = segment({he: "עברית"});
    const root = render([only], {isExpanded: true, toggleMerging});

    query(gemaraHebrew(root), ".material-icons").click();

    expect(toggleMerging).toHaveBeenCalledWith(only.uuid);
  });

  test("the most recently re-merged segment is flagged for a fade animation", () => {
    const first = segment({he: "ראשון"});
    const root = render([first, segment({he: "שני"})], {lastUnexpandedUuid: first.uuid});

    // Both the hebrew and the english of that part fade back in.
    const faded = queryAll(root, ".fadeInBackground");
    expect(faded).toHaveLength(2);
    expect(faded.map(x => x.getAttribute("sefaria-ref"))).toEqual([first.ref, first.ref]);
  });
});

describe("translation on double click", () => {
  const withSteinsaltz = () => segment({
    he: "עברית",
    en: "english",
    commentary: commentaries({Steinsaltz: [{he: "שטיינזלץ", en: "steinsaltz english"}]}),
  });

  test("double clicking the hebrew opens the translation", () => {
    localStorage.translationOption = "both";
    const root = render([withSteinsaltz()]);
    expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual([]);

    doubleClick(gemaraHebrew(root));

    expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual(["שטיינזלץ"]);
  });

  test("double clicking again closes it", () => {
    localStorage.translationOption = "both";
    const root = render([withSteinsaltz()]);

    doubleClick(gemaraHebrew(root));
    doubleClick(gemaraHebrew(root));

    expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual([]);
  });

  test("a segment with no translation ignores the double click", () => {
    const root = render([segment({he: "עברית", commentary: commentaries({Rashi: [{}]})})]);

    doubleClick(gemaraHebrew(root));

    expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual([]);
  });

  test("merged segments do not get the translation double-click listener", () => {
    // With more than one hebrew, double click means "expand the merge" instead.
    localStorage.translationOption = "both";
    const root = render([withSteinsaltz(), withSteinsaltz()]);

    doubleClick(gemaraHebrew(root));

    expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual([]);
  });
});

describe("commentaries", () => {
  test("commentary buttons are rendered for a segment that has them", () => {
    const root = render([segment({commentary: commentaries({Rashi: [{}]})})]);

    expect(texts(root, ".show-buttons a.rashi")).toEqual(['רש"י']);
  });

  test("no commentary block at all when there is none", () => {
    const root = render([segment()]);

    expect(queryOrNull(root, ".show-buttons")).toBeNull();
  });

  test("merged segments show the union of their commentaries", () => {
    const root = render([
      segment({commentary: commentaries({Rashi: [{}]})}),
      segment({commentary: commentaries({Tosafot: [{}]})}),
    ]);

    expect(texts(root, ".show-buttons a.commentary_header")).toEqual(['רש"י', "תוספות"]);
  });
});

describe("highlighting affordance", () => {
  test("a standalone segment is swipeable as a whole row", () => {
    const root = render([segment({he: "עברית", en: "english"})]);

    // One wrapper around the row itself, and none around the individual texts.
    expect(queryAll(gemaraRow(root), ".animateSwipeableBackground")).toHaveLength(0);
    expect(queryAll(root, ".animateSwipeableBackground")).toHaveLength(1);
  });

  test("merged segments are swipeable per part instead", () => {
    const root = render([
      segment({he: "ראשון", en: "first"}),
      segment({he: "שני", en: "second"}),
    ]);

    // Two hebrew parts and two english parts, each independently highlightable.
    expect(queryAll(root, ".animateSwipeableBackground")).toHaveLength(4);
  });
});

describe("the hidden host copy", () => {
  test("opens a commentary immediately so its height can be measured", () => {
    const root = mount(
      <TestContext overrides={{isFake: true}}>
        <Segment
          segments={[segment({
            he: "עברית",
            commentary: commentaries({Rashi: [{he: "פירוש"}]}),
          })]}
          segmentLabel={SEGMENT_LABEL}
          toggleMerging={() => {}}
          isExpanded={false}
          lastUnexpandedUuid={undefined}
          />
      </TestContext>,
    );

    expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual(["פירוש"]);
  });
});
