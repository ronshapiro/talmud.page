/**
 * Tests for `Renderer.buildConfiguration` / `buildHiddenHostConfiguration`, extracted from
 * `register()` so a test can obtain a production-shaped `Configuration` without mounting the
 * React tree, attaching the window resize listener, or bumping the `pageViews` counter that
 * triggers the feedback form (testability suggestion #2 in FrontendTestabilitySuggestions.md).
 */
import {Renderer} from "../Renderer";
import {getCommentaryTypes} from "../commentaryTypes";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

class TestRenderer extends Renderer {
  constructor(options: ConstructorParameters<typeof Renderer>[2] = {}) {
    super(
      getCommentaryTypes("talmud"),
      {
        previous: () => "1a",
        next: () => "3a",
        displayPrevious: () => "1a",
        displayNext: () => "3a",
        hasPrevious: () => true,
        hasNext: () => true,
        loadPrevious: () => {},
        loadNext: () => {},
        defaultEditText: () => "",
      },
      options);
  }

  newPageTitleHebrew(section: string): string {
    return `ברכות ${section}`;
  }

  rendererType(): string {
    return "TestRenderer";
  }

  ignoredSectionRefs(id: string): string[] {
    return [`ignored-${id}`];
  }
}

beforeEach(() => installPageEnvironment());
afterEach(clearPageEnvironment);

describe("buildConfiguration", () => {
  test("does not touch pageViews or render anything, unlike register()", () => {
    new TestRenderer().buildConfiguration();

    expect(localStorage.pageViews).toBeUndefined();
    expect(document.body.children.length).toBe(0);
  });

  test("reflects the renderer's own state", () => {
    const context = new TestRenderer({
      isTalmud: true,
      allowCompactLayout: true,
      expandTranslationOnMergedSectionExpansion: true,
    }).buildConfiguration();

    localStorage.layoutOption = "compact";

    expect(context.rendererType).toBe("TestRenderer");
    expect(context.commentaryTypes).toEqual(getCommentaryTypes("talmud"));
    expect(context.ignoredSectionRefs("2a")).toEqual(["ignored-2a"]);
    expect(context.expandTranslationOnMergedSectionExpansion).toBe(true);
    expect(context.compactLayout()).toBe(true);
    expect(context.isFake).toBeUndefined();
  });

  test("compactLayout is false when allowCompactLayout is false, regardless of layoutOption", () => {
    const context = new TestRenderer({allowCompactLayout: false}).buildConfiguration();
    localStorage.layoutOption = "compact";

    expect(context.compactLayout()).toBe(false);
  });

  test("commentaryTypesByClassName indexes commentaryTypes by className", () => {
    const context = new TestRenderer().buildConfiguration();
    const rashi = context.commentaryTypes.find(x => x.englishName === "Rashi")!;

    // Steinsaltz and Translation share a className and are deliberately excluded here — see
    // Observation #8 in FrontendTestingPlan.md for that pre-existing collision.
    expect(context.commentaryTypesByClassName[rashi.className]).toBe(rashi);
  });

  test("toggleHighlightedId still closes over its own highlightedIds", () => {
    const context = new TestRenderer().buildConfiguration();

    context.toggleHighlightedId(true, "some-id");
    expect(context.highlightedIds.has("some-id")).toBe(true);

    context.toggleHighlightedId(false, "some-id");
    expect(context.highlightedIds.has("some-id")).toBe(false);
  });
});

describe("buildHiddenHostConfiguration", () => {
  test("forces english-side-by-side, disables wrapping, and marks itself fake", () => {
    localStorage.translationOption = "both";
    localStorage.wrapTranslations = "true";
    const renderer = new TestRenderer();
    const base = renderer.buildConfiguration();

    const hidden = renderer.buildHiddenHostConfiguration(base);

    expect(hidden.translationOption()).toBe("english-side-by-side");
    expect(hidden.wrapTranslations()).toBe(false);
    expect(hidden.isFake).toBe(true);
  });

  test("otherwise carries over the base configuration unchanged", () => {
    const renderer = new TestRenderer({isTalmud: true});
    const base = renderer.buildConfiguration();

    const hidden = renderer.buildHiddenHostConfiguration(base);

    expect(hidden.rendererType).toBe(base.rendererType);
    expect(hidden.commentaryTypes).toBe(base.commentaryTypes);
    expect(hidden.highlightedIds).toBe(base.highlightedIds);
  });
});
