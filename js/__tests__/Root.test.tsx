import * as React from "react";
import {Root} from "../Root";
import {UiPage} from "../Page";
import {TestConfiguration, TestContext} from "./testing/configuration";
import {
  flush,
  mount,
  query,
  queryAll,
  queryOrNull,
  texts,
  unmountAll,
} from "./testing/dom";
import {
  PageEnvironment,
  clearPageEnvironment,
  installPageEnvironment,
} from "./testing/page_environment";
import {page, resetFixtureCounter, segment} from "./testing/fixtures";

let environment: PageEnvironment;

beforeEach(() => {
  environment = installPageEnvironment();
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

const NAVIGATION_EXTENSION = {
  previous: () => "1b",
  next: () => "3a",
  displayPrevious: () => "1b",
  displayNext: () => "3a",
  hasPrevious: () => true,
  hasNext: () => true,
  loadPrevious: () => {},
  loadNext: () => {},
  defaultEditText: () => "",
};

interface RenderOptions {
  isFake?: boolean;
  configuration?: TestConfiguration;
  overrides?: Partial<TestConfiguration>;
}

interface RenderedRoot {
  container: HTMLElement;
  ready: () => void;
  forceUpdate: () => void;
}

function render(pages: UiPage[], options: RenderOptions = {}): RenderedRoot {
  const setIsReadyRef = {current: undefined as any};
  const forceUpdateRef = {current: undefined as any};
  const container = mount(
    <TestContext configuration={options.configuration} overrides={options.overrides}>
      <Root
        allAmudim={() => pages}
        isFake={options.isFake}
        navigationExtension={NAVIGATION_EXTENSION}
        setIsReadyRef={setIsReadyRef}
        forceUpdateRef={forceUpdateRef}
        />
    </TestContext>,
  );
  return {
    container,
    ready: () => flush(() => setIsReadyRef.current()),
    forceUpdate: () => flush(() => forceUpdateRef.current()),
  };
}

const amudIds = (container: HTMLElement) => (
  queryAll(container, ".amudContainer").map(x => x.id));

describe("the ready gate", () => {
  test("renders nothing before being declared ready", () => {
    const {container} = render([page()]);

    expect(container.innerHTML).toBe("");
  });

  test("renders the pages once ready", () => {
    const root = render([page({id: "2a"})]);

    root.ready();

    expect(amudIds(root.container)).toEqual(["amud-2a"]);
  });

  test("the hidden host copy skips the gate, since it is never declared ready", () => {
    const {container} = render([page({id: "2a"})], {isFake: true});

    expect(amudIds(container)).toEqual(["amud-2a"]);
  });
});

describe("pages", () => {
  test("renders every page in the order given", () => {
    const root = render([page({id: "2a"}), page({id: "2b"}), page({id: "3a"})]);
    root.ready();

    expect(amudIds(root.container)).toEqual(["amud-2a", "amud-2b", "amud-3a"]);
  });

  test("a lone page is not removable from either end", () => {
    const root = render([page({id: "2a"})]);
    root.ready();

    expect(query(root.container, ".remove-section-button").style.visibility).toBe("hidden");
  });

  test("with several pages, only the first and last can be removed", () => {
    const root = render([page({id: "2a"}), page({id: "2b"}), page({id: "3a"})]);
    root.ready();

    const visibilities = queryAll(root.container, ".remove-section-button")
      .map(x => x.style.visibility);
    expect(visibilities).toEqual(["", "hidden", ""]);
  });

  test("pages are re-read from the callback on a forced update", () => {
    const pages = [page({id: "2a", sections: [segment({he: "לפני"})]})];
    const root = render(pages);
    root.ready();
    expect(texts(root.container, ".gemara-container .table-cell.hebrew")).toEqual(["לפני"]);

    pages.push(page({id: "2b", sections: [segment({he: "אחרי"})]}));
    root.forceUpdate();

    expect(amudIds(root.container)).toEqual(["amud-2a", "amud-2b"]);
  });
});

describe("the feedback gate", () => {
  test("replaces the whole page when the form is due", () => {
    localStorage.showFeedbackForm = "true";
    const root = render([page({id: "2a"})]);
    root.ready();

    expect(amudIds(root.container)).toEqual([]);
    expect(root.container.textContent).toContain("Feedback");
  });

  test("a dismissed form does not reappear", () => {
    localStorage.showFeedbackForm = "ignored";
    const root = render([page({id: "2a"})]);
    root.ready();

    expect(amudIds(root.container)).toEqual(["amud-2a"]);
  });

  test("the hidden host copy never shows the form", () => {
    localStorage.showFeedbackForm = "true";
    const {container} = render([page({id: "2a"})], {isFake: true});

    expect(amudIds(container)).toEqual(["amud-2a"]);
  });
});

describe("interactive chrome", () => {
  test("the real page gets navigation buttons and settings", () => {
    const root = render([page({id: "2a"})]);
    root.ready();

    expect(queryAll(root.container, ".navigation-button-container").length).toBeGreaterThan(0);
    expect(queryOrNull(root.container, "#showSettings")).not.toBeNull();
  });

  test("material design components are upgraded after each render", () => {
    const root = render([page({id: "2a"})]);
    const before = environment.upgradeAllRegisteredCount();

    root.ready();

    expect(environment.upgradeAllRegisteredCount()).toBeGreaterThan(before);
  });
});

describe("the language chooser", () => {
  test("takes over on a first visit", () => {
    localStorage.needsToPickLanguage = "true";
    const root = render([page({id: "2a"})]);
    root.ready();

    expect(root.container.textContent).toContain("Welcome");
    expect(amudIds(root.container)).toEqual([]);
  });

  test("choosing a language reveals the page", () => {
    localStorage.needsToPickLanguage = "true";
    const root = render([page({id: "2a"})]);
    root.ready();

    query(root.container, "button.mdl-button--colored").click();

    expect(localStorage.needsToPickLanguage).toBeUndefined();
    expect(amudIds(root.container)).toEqual(["amud-2a"]);
  });

  test("is skipped once a language has been chosen", () => {
    const root = render([page({id: "2a"})]);
    root.ready();

    expect(root.container.textContent).not.toContain("Welcome");
  });
});

// Search highlighting is driven from the snackbar; it is covered in SearchHighlighting.test.tsx.
