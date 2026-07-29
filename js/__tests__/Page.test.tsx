import * as React from "react";
import {Page, UiPage} from "../Page";
import {TestConfiguration, TestContext} from "./testing/configuration";
import {
  classesOf,
  click,
  doubleClick,
  mount,
  query,
  queryAll,
  queryOrNull,
  texts,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";
import {page, resetFixtureCounter, segment} from "./testing/fixtures";
import {UiSegment} from "../Segment";

beforeEach(() => {
  installPageEnvironment();
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

interface RenderOptions {
  navigationExtension?: any;
  firstRemovable?: boolean;
  lastRemovable?: boolean;
  context?: Partial<TestConfiguration>;
}

function render(amudData: UiPage, options: RenderOptions = {}): HTMLElement {
  return mount(
    <TestContext overrides={options.context ?? {}}>
      <Page
        amudData={amudData}
        navigationExtension={options.navigationExtension ?? {}}
        firstRemovable={options.firstRemovable ?? false}
        lastRemovable={options.lastRemovable ?? false}
        />
    </TestContext>,
  );
}

/** The refs rendered in each segment container, grouped — i.e. the merge grouping. */
function renderedGroups(root: HTMLElement): string[][] {
  return queryAll(root, ".segment-container").map(
    container => queryAll(container, ".gemara-container span[sefaria-ref]")
      .map(x => x.getAttribute("sefaria-ref")!)
      .filter((ref, i, all) => all.indexOf(ref) === i));
}

/** Marks all segments as mergeable, which is what the API does for prose. */
function mergeable(overrides: Partial<UiSegment> = {}): UiSegment {
  return segment({defaultMergeWithNext: true, ...overrides});
}

describe("container", () => {
  test("is identified by amud id", () => {
    const root = render(page({id: "3b"}));

    const container = query(root, ".amudContainer");
    expect(container.id).toBe("amud-3b");
    expect(container.dataset.amud).toBe("3b");
  });
});

describe("title", () => {
  test("shows the english title in side-by-side mode", () => {
    const root = render(page({id: "2a", title: "Berakhot 2a", titleHebrew: "ברכות ב."}));

    const title = query(root, ".titleContainer span");
    expect(title.textContent).toBe("Berakhot 2a");
    expect(classesOf(title)).toEqual(["title"]);
    expect(title.getAttribute("dir")).toBe("ltr");
  });

  test("shows the hebrew title in other modes", () => {
    localStorage.translationOption = "both";
    const root = render(page({id: "2a", title: "Berakhot 2a", titleHebrew: "ברכות ב."}));

    const title = query(root, ".titleContainer span");
    expect(title.textContent).toBe("ברכות ב.");
    expect(classesOf(title)).toEqual(["titleHebrew"]);
    expect(title.getAttribute("dir")).toBe("rtl");
  });

  test("a page without a title renders no title container", () => {
    const root = render(page({title: ""}));

    expect(queryOrNull(root, ".titleContainer")).toBeNull();
  });

  test("segment counts are appended when the metadata setting is on", () => {
    localStorage.showPageMetadata = "true";
    const root = render(page({
      sections: [segment(), segment({steinsaltz_start_of_sugya: true}), segment()],
    }));

    expect(query(root, ".segmentCount").textContent).toBe("(1, 2)");
  });

  test("segment counts are hidden by default", () => {
    const root = render(page());

    expect(queryOrNull(root, ".segmentCount")).toBeNull();
  });

  test("double clicking the title collapses the page contents", () => {
    const root = render(page());
    expect(queryAll(root, ".segment-container").length).toBeGreaterThan(0);

    doubleClick(query(root, ".titleContainer span"));

    expect(queryAll(root, ".segment-container")).toHaveLength(0);
    expect(queryOrNull(root, ".titleContainer")).not.toBeNull();
  });
});

describe("removing loaded pages", () => {
  test("the remove button is hidden but present when the page is not removable", () => {
    const root = render(page());

    expect(query(root, ".remove-section-button").style.visibility).toBe("hidden");
  });

  test("removing the first page calls removeFirst", () => {
    const navigationExtension = {removeFirst: jest.fn(), removeLast: jest.fn()};
    const root = render(page(), {firstRemovable: true, navigationExtension});

    expect(query(root, ".remove-section-button").style.visibility).toBe("");
    click(query(root, ".remove-section-button"));

    expect(navigationExtension.removeFirst).toHaveBeenCalledTimes(1);
    expect(navigationExtension.removeLast).not.toHaveBeenCalled();
  });

  test("removing the last page calls removeLast", () => {
    const navigationExtension = {removeFirst: jest.fn(), removeLast: jest.fn()};
    const root = render(page(), {lastRemovable: true, navigationExtension});

    click(query(root, ".remove-section-button"));

    expect(navigationExtension.removeLast).toHaveBeenCalledTimes(1);
  });

  test("there is no remove button when navigation is disabled", () => {
    const root = render(page(), {navigationExtension: {disableNavigation: true}});

    expect(queryOrNull(root, ".remove-section-button")).toBeNull();
  });
});

describe("loading state", () => {
  test("shows a spinner while loading", () => {
    const root = render(page({loading: true, sections: []}));

    expect(queryAll(root, ".text-loading-spinner")).toHaveLength(1);
  });

  test("shows an error alongside the spinner", () => {
    const root = render(page({loading: true, sections: [], errorEnglish: "Could not load"}));

    expect(root.textContent).toContain("Could not load");
  });

  test("no spinner once loaded", () => {
    const root = render(page());

    expect(queryAll(root, ".text-loading-spinner")).toHaveLength(0);
  });
});

describe("ignored sections", () => {
  test("refs reported as ignored are not rendered", () => {
    const root = render(
      page({sections: [segment({ref: "keep"}), segment({ref: "drop"})]}),
      {context: {ignoredSectionRefs: () => ["drop"]}});

    expect(renderedGroups(root)).toEqual([["keep"]]);
  });

  test("the ignore list is scoped to the amud id", () => {
    const seen: string[] = [];
    render(page({id: "5b"}), {context: {ignoredSectionRefs: id => { seen.push(id); return []; }}});

    expect(seen).toContain("5b");
  });
});

describe("segment merging", () => {
  test("segments are separate by default", () => {
    const root = render(page({
      sections: [segment({ref: "a"}), segment({ref: "b"})],
    }));

    expect(renderedGroups(root)).toEqual([["a"], ["b"]]);
  });

  test("defaultMergeWithNext joins a run of segments", () => {
    const root = render(page({
      sections: [mergeable({ref: "a"}), mergeable({ref: "b"}), segment({ref: "c"})],
    }));

    expect(renderedGroups(root)).toEqual([["a", "b", "c"]]);
  });

  test("a segment that does not merge ends the run", () => {
    const root = render(page({
      sections: [mergeable({ref: "a"}), segment({ref: "b"}), segment({ref: "c"})],
    }));

    expect(renderedGroups(root)).toEqual([["a", "b"], ["c"]]);
  });

  test("compact layout merges everything, regardless of the API's hint", () => {
    localStorage.layoutOption = "compact";
    const root = render(page({
      sections: [segment({ref: "a"}), segment({ref: "b"}), segment({ref: "c"})],
    }));

    expect(renderedGroups(root)).toEqual([["a", "b", "c"]]);
  });

  test("lastSegmentOfSection ends a run even in compact layout", () => {
    localStorage.layoutOption = "compact";
    const root = render(page({
      sections: [
        segment({ref: "a"}),
        segment({ref: "b", lastSegmentOfSection: true}),
        segment({ref: "c"}),
      ],
    }));

    expect(renderedGroups(root)).toEqual([["a", "b"], ["c"]]);
  });

  test("a start-of-sugya segment starts a new run", () => {
    localStorage.layoutOption = "compact";
    const root = render(page({
      sections: [
        segment({ref: "a"}),
        segment({ref: "b", steinsaltz_start_of_sugya: true}),
        segment({ref: "c"}),
      ],
    }));

    expect(renderedGroups(root)).toEqual([["a"], ["b", "c"]]);
  });

  test("a hadran segment starts a new run", () => {
    localStorage.layoutOption = "compact";
    const root = render(page({
      sections: [segment({ref: "a"}), segment({ref: "Hadran 1", hadran: true})],
    }));

    expect(renderedGroups(root)).toEqual([["a"], ["Hadran 1"]]);
  });

  test("double clicking a merged segment splits it out", () => {
    const root = render(page({
      sections: [mergeable({ref: "a"}), mergeable({ref: "b"}), segment({ref: "c"})],
    }));
    expect(renderedGroups(root)).toEqual([["a", "b", "c"]]);

    doubleClick(query(root, '.gemara-container span[sefaria-ref="a"] .hebrew-ref-text'));

    expect(renderedGroups(root)).toEqual([["a"], ["b", "c"]]);
  });

  test("closing an expanded segment merges it back", () => {
    const root = render(page({
      sections: [mergeable({ref: "a"}), mergeable({ref: "b"}), segment({ref: "c"})],
    }));
    doubleClick(query(root, '.gemara-container span[sefaria-ref="a"] .hebrew-ref-text'));

    query(root, ".segment-container .material-icons").click();

    expect(renderedGroups(root)).toEqual([["a", "b", "c"]]);
  });
});

describe("separators", () => {
  test("a separator is drawn before a start-of-sugya segment", () => {
    const root = render(page({
      sections: [segment({ref: "a"}), segment({ref: "b", steinsaltz_start_of_sugya: true})],
    }));

    expect(queryAll(root, ".section-separator")).toHaveLength(1);
  });

  test("no separator before the very first segment", () => {
    const root = render(page({
      sections: [segment({ref: "a", steinsaltz_start_of_sugya: true}), segment({ref: "b"})],
    }));

    expect(queryAll(root, ".section-separator")).toHaveLength(0);
  });

  test("a separator is drawn before a hadran", () => {
    const root = render(page({
      sections: [segment({ref: "a"}), segment({ref: "Hadran 1", hadran: true})],
    }));

    expect(queryAll(root, ".section-separator")).toHaveLength(1);
  });

  test("a separator is drawn after the last segment of a section", () => {
    const root = render(page({
      sections: [
        segment({ref: "a", lastSegmentOfSection: true}),
        segment({ref: "b"}),
      ],
    }));

    expect(queryAll(root, ".section-separator")).toHaveLength(1);
  });

  test("no trailing separator after the final segment of the page", () => {
    const root = render(page({
      sections: [segment({ref: "a"}), segment({ref: "b", lastSegmentOfSection: true})],
    }));

    expect(queryAll(root, ".section-separator")).toHaveLength(0);
  });
});

describe("segment labels", () => {
  test("segments are labelled by amud and ordinal position", () => {
    const root = render(page({
      id: "2a",
      sections: [segment({ref: "a"}), segment({ref: "b"})],
    }));

    expect(queryAll(root, ".segment-container").map(x => x.id))
      .toEqual(["2a_section_1", "2a_section_2"]);
  });

  test("merged segments consume the labels of the segments they contain", () => {
    const root = render(page({
      sections: [mergeable({ref: "a"}), segment({ref: "b"}), segment({ref: "c"})],
    }));

    expect(queryAll(root, ".segment-container").map(x => x.id))
      .toEqual(["2a_section_1", "2a_section_3"]);
  });
});

describe("commentaries within a page", () => {
  test("each segment gets its own commentary buttons", () => {
    const root = render(page({
      sections: [
        segment({ref: "a",
          commentary: {Rashi: {comments: [{
            ref: "r", he: "רשי", en: "rashi", sourceRef: "s", sourceHeRef: "s",
          }]}}}),
        segment({ref: "b"}),
      ],
    }));

    expect(texts(root, ".show-buttons a.commentary_header")).toEqual(['רש"י']);
  });
});
