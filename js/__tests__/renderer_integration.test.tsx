/**
 * End-to-end tests that drive a real `Renderer`, exercising the whole tree from the data the API
 * returns down to the DOM, including the hidden host and the production configuration object.
 *
 * These are deliberately behavioral: they assert what a reader would see and what happens when
 * they interact, not the structure of the markup.
 */
import {MountedRenderer, mountRenderer} from "./testing/renderer_harness";
import {click, doubleClick, queryAll, unmountAll} from "./testing/dom";
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

const gemaraTexts = (app: MountedRenderer) => (
  app.textsOf(".gemara-container .table-cell.hebrew"));
const commentTexts = (app: MountedRenderer) => (
  app.textsOf(".IndividualComment .table-cell.hebrew"));
const visiblePages = (app: MountedRenderer) => app.all(".amudContainer").map(x => x.id);

const simplePage = () => page({
  id: "2a",
  sections: [
    segment({ref: "Berakhot 2a:1", he: "מאימתי", en: "From when"}),
    segment({
      ref: "Berakhot 2a:2",
      he: "קורין את שמע",
      en: "do we recite shema",
      commentary: commentaries({
        Rashi: [{ref: "Rashi on Berakhot 2a:2", he: 'פירוש רש"י', en: "Rashi's comment"}],
      }),
    }),
  ],
});

describe("first render", () => {
  test("renders the page title and every segment", () => {
    const app = mountRenderer([simplePage()]);

    expect(app.find(".title").textContent).toContain("Berakhot 2a");
    expect(gemaraTexts(app)).toEqual(["מאימתי", "קורין את שמע"]);
  });

  test("nothing is rendered until the renderer is declared ready", () => {
    const app = mountRenderer([simplePage()], {declareReady: false});
    expect(app.all(".amudContainer")).toHaveLength(0);

    app.declareReady();

    expect(app.all(".amudContainer")).toHaveLength(1);
  });

  test("commentary is hidden behind a button initially", () => {
    const app = mountRenderer([simplePage()]);

    expect(commentTexts(app)).toEqual([]);
    expect(app.textsOf(".show-buttons a.rashi")).toEqual(['רש"י']);
  });

  test("the hidden measuring host is rendered alongside the real content", () => {
    mountRenderer([simplePage()]);

    expect(queryAll(document.body, ".hidden-host")).toHaveLength(1);
  });

  test("navigation buttons for the neighbouring pages are offered", () => {
    const app = mountRenderer([simplePage()]);

    expect(app.all(".navigation-button-container").length).toBeGreaterThan(0);
  });
});

describe("reading a commentary", () => {
  test("clicking a commentary button reveals it, clicking again hides it", () => {
    const app = mountRenderer([simplePage()]);

    click(app.find(".show-buttons a.rashi"));
    expect(commentTexts(app)).toEqual(['פירוש רש"י']);

    click(app.find("a.rashi"));
    expect(commentTexts(app)).toEqual([]);
  });

  test("commentary opens only on the segment that was clicked", () => {
    const app = mountRenderer([page({
      id: "2a",
      sections: [
        segment({ref: "a", commentary: commentaries({Rashi: [{he: "ראשון"}]})}),
        segment({ref: "b", commentary: commentaries({Rashi: [{he: "שני"}]})}),
      ],
    })]);

    click(app.all(".show-buttons a.rashi")[1]);

    expect(commentTexts(app)).toEqual(["שני"]);
  });
});

describe("loading and removing pages", () => {
  test("pages render in amud order regardless of arrival order", () => {
    window.history.replaceState({}, "", "/Berakhot/2a/to/3a");
    const app = mountRenderer([
      page({id: "2b", sections: [segment({he: "ב"})]}),
      page({id: "2a", sections: [segment({he: "א"})]}),
      page({id: "3a", sections: [segment({he: "ג"})]}),
    ]);

    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b", "amud-3a"]);
  });

  test("a newly loaded page appears without disturbing the others", () => {
    const app = mountRenderer([page({id: "2a", sections: [segment({he: "א"})]})]);

    // Mirrors `page_runner.requestSection`: register a loading placeholder, extend the URL, then
    // replace the placeholder with the response. The renderer looks pages up by the ids in the
    // URL range, so the placeholder has to exist before the range grows.
    app.setPage(page({id: "2b", loading: true, sections: []}));
    window.history.replaceState({}, "", "/Berakhot/2a/to/2b");
    app.setPage(page({id: "2b", sections: [segment({he: "ב"})]}));

    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b"]);
    expect(gemaraTexts(app)).toEqual(["א", "ב"]);
  });

  test("a page in the url range that is still loading shows its placeholder", () => {
    const app = mountRenderer([page({id: "2a", sections: [segment({he: "א"})]})]);

    app.setPage(page({id: "2b", loading: true, sections: [], errorEnglish: "Still going..."}));
    window.history.replaceState({}, "", "/Berakhot/2a/to/2b");
    app.setPage(page({id: "2b", loading: true, sections: [], errorEnglish: "Still going..."}));

    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b"]);
    expect(app.all(".text-loading-spinner")).toHaveLength(1);
    expect(app.container.textContent).toContain("Still going...");
  });

  test("a removed page disappears", () => {
    window.history.replaceState({}, "", "/Berakhot/2a/to/2b");
    const app = mountRenderer([
      page({id: "2a", sections: [segment({he: "א"})]}),
      page({id: "2b", sections: [segment({he: "ב"})]}),
    ]);

    window.history.replaceState({}, "", "/Berakhot/2a");
    app.removePage("2b");

    expect(visiblePages(app)).toEqual(["amud-2a"]);
  });

  test("a page still loading shows a spinner", () => {
    const app = mountRenderer([page({id: "2a", loading: true, sections: []})]);

    expect(app.all(".text-loading-spinner")).toHaveLength(1);
  });
});

describe("translation modes", () => {
  const withSteinsaltz = () => page({
    id: "2a",
    sections: [segment({
      ref: "Berakhot 2a:1",
      he: "מאימתי",
      en: "From when",
      commentary: commentaries({
        Steinsaltz: [{ref: "Steinsaltz 2a:1", he: "שטיינזלץ", en: "steinsaltz english"}],
      }),
    })],
  });

  test("side by side shows hebrew and english in the same row", () => {
    const app = mountRenderer([withSteinsaltz()], {isTalmud: true});

    expect(app.textsOf(".gemara-container .table-cell.hebrew")).toEqual(["מאימתי"]);
    expect(app.textsOf(".gemara-container .table-cell.english")).toEqual(["From when"]);
  });

  test("'both' mode moves the translation into the commentary area", () => {
    localStorage.translationOption = "both";
    localStorage.showTranslationButton = "yes";
    const app = mountRenderer([withSteinsaltz()], {isTalmud: true});

    expect(app.all(".gemara-container .table-cell.english")).toHaveLength(0);

    click(app.find(".show-buttons a.translation"));

    expect(commentTexts(app)).toEqual(["שטיינזלץ"]);
  });

  test("hebrew mode drops english everywhere", () => {
    localStorage.languageOption = "hebrew";
    const app = mountRenderer([simplePage()], {isTalmud: true});

    expect(app.all(".table-cell.english")).toHaveLength(0);
    expect(app.find(".titleHebrew").textContent).toContain("ברכות");
  });

  test("double clicking the hebrew opens the translation in 'both' mode", () => {
    localStorage.translationOption = "both";
    const app = mountRenderer([withSteinsaltz()], {isTalmud: true});

    doubleClick(app.find(".gemara-container .table-cell.hebrew"));

    expect(commentTexts(app)).toEqual(["שטיינזלץ"]);
  });
});

describe("layout modes", () => {
  const threeSegments = () => page({
    id: "2a",
    sections: [
      segment({ref: "a", he: "א"}),
      segment({ref: "b", he: "ב"}),
      segment({ref: "c", he: "ג"}),
    ],
  });

  test("segments are separate in the default layout", () => {
    const app = mountRenderer([threeSegments()], {allowCompactLayout: true});

    expect(app.all(".segment-container")).toHaveLength(3);
  });

  test("compact layout merges them into one", () => {
    localStorage.layoutOption = "compact";
    const app = mountRenderer([threeSegments()], {allowCompactLayout: true});

    expect(app.all(".segment-container")).toHaveLength(1);
    expect(gemaraTexts(app)).toEqual(["א ב ג"]);
  });

  test("compact layout is ignored by renderers that do not allow it", () => {
    localStorage.layoutOption = "compact";
    const app = mountRenderer([threeSegments()], {allowCompactLayout: false});

    expect(app.all(".segment-container")).toHaveLength(3);
  });

  test("a merged segment can be split apart and put back", () => {
    localStorage.layoutOption = "compact";
    const app = mountRenderer([threeSegments()], {allowCompactLayout: true});

    doubleClick(app.find('.gemara-container span[sefaria-ref="a"] .hebrew-ref-text'));
    expect(app.all(".segment-container")).toHaveLength(2);

    app.find(".segment-container .material-icons").click();
    expect(app.all(".segment-container")).toHaveLength(1);
  });
});

describe("renderer-level filtering", () => {
  test("ignored refs never reach the page", () => {
    const app = mountRenderer(
      [page({
        id: "2a",
        sections: [segment({ref: "keep", he: "נשאר"}), segment({ref: "skip", he: "מדולג"})],
      })],
      {ignoredSectionRefs: ["skip"]});

    expect(gemaraTexts(app)).toEqual(["נשאר"]);
  });
});

describe("personal notes from Drive", () => {
  test("notes for a ref are shown as a commentary on that segment", () => {
    const app = mountRenderer([simplePage()], {
      driveClient: {
        commentsForRef: (ref: string) => (ref === "Berakhot 2a:1"
          ? {comments: [{
            ref: "note-1",
            he: "הערה אישית",
            en: "my note",
            sourceRef: "Personal Notes",
            sourceHeRef: "הערות אישיות",
          }]}
          : undefined),
        highlightsForRef: () => [],
      } as any,
    });

    click(app.find(".show-buttons a.personal-notes"));

    expect(commentTexts(app)).toEqual(["הערה אישית"]);
  });

  test("segments without notes get no personal notes button", () => {
    const app = mountRenderer([simplePage()]);

    expect(app.findOrNull("a.personal-notes")).toBeNull();
  });
});

describe("the feedback form", () => {
  test("takes over the page once enough views have accumulated", () => {
    localStorage.showFeedbackForm = "true";
    const app = mountRenderer([simplePage()]);

    expect(app.all(".amudContainer")).toHaveLength(0);
  });
});
