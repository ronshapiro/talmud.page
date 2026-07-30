/**
 * The in-page search path, end to end: the snackbar collects a query, `Root` stores it on the
 * configuration, and every `TableRow` wraps matches as it renders.
 *
 * Searches are started through `window.SEARCH`, which is the same entry point
 * `ref_selection_snackbar` uses when the reader searches for selected text. That avoids
 * simulating `contenteditable` input while still going through the production code path.
 */
import {MountedRenderer, mountRenderer} from "./testing/renderer_harness";
import {click, flush, unmountAll} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";
import {commentaries, page, resetFixtureCounter, segment} from "./testing/fixtures";

beforeEach(() => {
  installPageEnvironment({book: "Berakhot", path: "/Berakhot/2a"});
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  document.getElementById("main-contents")?.remove();
  clearPageEnvironment();
});

const searchablePage = () => page({
  id: "2a",
  sections: [
    segment({ref: "Berakhot 2a:1", he: "מאימתי קורין את שמע", en: "From when do we recite shema"}),
    segment({
      ref: "Berakhot 2a:2",
      he: "בערבין",
      en: "in the evening",
      commentary: commentaries({
        Rashi: [{ref: "Rashi 2a:2", he: "שמע ישראל", en: "hear O Israel"}],
      }),
    }),
  ],
});

const search = (text: string) => flush(() => (window as any).SEARCH(text));
const foundTerms = (app: MountedRenderer) => app.all("span-search-term");
const openSearchBar = (app: MountedRenderer) => click(app.find("#showSearch button"));

describe("the search snackbar", () => {
  test("is collapsed until the search button is clicked", () => {
    const app = mountRenderer([searchablePage()]);

    expect(app.findOrNull("#snackbars")).toBeNull();

    openSearchBar(app);

    expect(app.findOrNull("#snackbars")).not.toBeNull();
  });

  test("closes again on a second click", () => {
    const app = mountRenderer([searchablePage()]);

    openSearchBar(app);
    openSearchBar(app);

    expect(app.findOrNull("#snackbars")).toBeNull();
  });

  test("opens by itself when a search is started from selected text", () => {
    const app = mountRenderer([searchablePage()]);

    search("שמע");

    expect(app.findOrNull("#snackbars")).not.toBeNull();
  });
});

describe("highlighting matches", () => {
  test("matching hebrew is wrapped in the first color", () => {
    const app = mountRenderer([searchablePage()]);

    search("שמע");

    expect(foundTerms(app).map(x => x.textContent)).toEqual(["שמע"]);
    expect([...foundTerms(app)[0].classList]).toEqual(["foundTerm", "yellow"]);
  });

  test("matching english is highlighted too", () => {
    const app = mountRenderer([searchablePage()]);

    search("shema");

    expect(foundTerms(app).map(x => x.textContent)).toEqual(["shema"]);
  });

  test("matches inside an open commentary are highlighted", () => {
    const app = mountRenderer([searchablePage()]);
    click(app.all(".show-buttons a.rashi")[0]);

    search("שמע");

    // Once in the gemara text, once in Rashi.
    expect(foundTerms(app)).toHaveLength(2);
  });

  test("a query too short to be useful highlights nothing", () => {
    const app = mountRenderer([searchablePage()]);

    search("ש");

    expect(foundTerms(app)).toHaveLength(0);
  });

  test("a query matching nothing highlights nothing", () => {
    const app = mountRenderer([searchablePage()]);

    search("qwerty");

    expect(foundTerms(app)).toHaveLength(0);
  });

  test("every occurrence is highlighted, not just the first", () => {
    const app = mountRenderer([page({
      id: "2a",
      sections: [
        segment({ref: "a", he: "שמע שמע", en: "one"}),
        segment({ref: "b", he: "שמע", en: "two"}),
      ],
    })]);

    search("שמע");

    expect(foundTerms(app)).toHaveLength(3);
  });
});

describe("multiple searches", () => {
  test("a second search gets its own color", () => {
    const app = mountRenderer([searchablePage()]);

    search("שמע");
    search("קורין");

    const byColor = foundTerms(app).map(x => [...x.classList][1]);
    expect(byColor.sort()).toEqual(["purple", "yellow"]);
  });

  test("the match counter reports how many were found", () => {
    const app = mountRenderer([page({
      id: "2a",
      sections: [segment({ref: "a", he: "שמע שמע שמע", en: "x"})],
    })]);

    search("שמע");

    expect(app.find(".searchMatchCounter").textContent).toContain("3");
  });
});

describe("clearing a search", () => {
  test("clearing the text removes the highlights", () => {
    const app = mountRenderer([searchablePage()]);
    search("שמע");
    expect(foundTerms(app)).toHaveLength(1);

    click(app.find("#snackbars .mdl-button"));

    expect(foundTerms(app)).toHaveLength(0);
  });
});
