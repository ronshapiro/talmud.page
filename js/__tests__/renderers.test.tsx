/**
 * The per-renderer differences.
 *
 * Each page type (talmud_page, mishna, tanakh, shulchan_arukh_renderer, mishneh_torah_renderer,
 * peninei_halacha_renderer, liturgy_renderer)
 * subclasses `Renderer` and differs in only a handful of ways: which commentary types it offers,
 * how it computes the previous/next section, whether compact layout is allowed, what its versions
 * are, how it formats a hebrew page title, and which section refs it drops.
 *
 * Most of those entry points call `new Runner(...).main()` at module scope, so importing them
 * would boot the whole app. `liturgy_renderer.js` is the exception and is imported directly. For
 * the rest, the differing behavior lives in the shared pieces they configure — the commentary
 * type lists, `numericalNavigationExtension`, and the title formatters — which are what these
 * tests exercise. See suggestion #12 in FrontendTestabilitySuggestions.md.
 */
import * as React from "react";
import {Renderer, numericalNavigationExtension} from "../Renderer";
import {Segment} from "../Segment";
import {LiturgyRenderer} from "../liturgy_renderer";
import {getCommentaryTypes} from "../commentaryTypes";
import {UiPage} from "../Page";
import {books} from "../books";
import {formatDafInHebrew, makeAmudSmall} from "../../talmud";
import {mishnehTorahHebrewTitleName, penineiHalachaHebrewTitleName} from "../../hebrew";
import {mountRenderer} from "./testing/renderer_harness";
import {TestContext} from "./testing/configuration";
import {mount, texts, unmountAll} from "./testing/dom";
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

/** A stand-in for the entry-point subclasses, parameterized the same way they are. */
class ConfigurableRenderer extends Renderer {
  constructor(
    resourceType: Parameters<typeof getCommentaryTypes>[0],
    navigationExtension: any,
    options: any,
    private readonly type: string,
    private readonly hebrewTitle: (section: string) => string
    = (section: string) => section,
    private readonly ownVersions: {hebrew: string, english: string}[] = [],
  ) {
    super(getCommentaryTypes(resourceType), navigationExtension, options);
  }

  newPageTitleHebrew(section: string): string {
    return this.hebrewTitle(section);
  }

  rendererType(): string {
    return this.type;
  }

  versions() {
    return this.ownVersions;
  }
}

describe("commentary types per resource type", () => {
  const namesFor = (resourceType: Parameters<typeof getCommentaryTypes>[0]) => (
    getCommentaryTypes(resourceType).map(x => x.englishName));

  test("talmud offers Steinsaltz", () => {
    expect(namesFor("talmud")).toContain("Steinsaltz");
  });

  test("mishneh torah offers Steinsaltz too", () => {
    expect(namesFor("mishneh torah")).toContain("Steinsaltz");
  });

  test("mishna, tanakh and siddur do not", () => {
    for (const resourceType of ["mishna", "tanakh", "siddur"] as const) {
      expect(namesFor(resourceType)).not.toContain("Steinsaltz");
    }
  });

  test("an unrecognized resource type still gets the shared list", () => {
    // `shulchan arukh` and `peninei halacha` are passed by their renderers but are not among the
    // names the function switches on, so they take the default path.
    const shulchanArukh = namesFor("shulchan arukh" as any);

    expect(shulchanArukh).not.toContain("Steinsaltz");
    expect(shulchanArukh).toContain("Personal Notes");
  });

  test("every list ends with personal notes", () => {
    for (const resourceType of
      ["talmud", "mishneh torah", "mishna", "tanakh", "siddur"] as const) {
      expect(namesFor(resourceType).at(-1)).toBe("Personal Notes");
    }
  });

  test("the lists are otherwise identical", () => {
    const withoutSteinsaltz = (names: string[]) => names.filter(x => x !== "Steinsaltz");

    expect(withoutSteinsaltz(namesFor("talmud"))).toEqual(namesFor("mishna"));
    expect(namesFor("tanakh")).toEqual(namesFor("siddur"));
  });

  test("a fresh list is returned each time, so callers cannot corrupt it", () => {
    const first = getCommentaryTypes("talmud");
    first.push({englishName: "Injected", hebrewName: "x", className: "injected"});

    expect(getCommentaryTypes("talmud").map(x => x.englishName)).not.toContain("Injected");
  });
});

describe("numbered books (Mishna, Tanakh, Mishneh Torah, Shulchan Arukh)", () => {
  const numbered = (path: string, book = "Genesis") => installPageEnvironment({book, path});

  test("the previous and next sections are simple arithmetic", () => {
    numbered("/Genesis/4/to/6");
    const extension = numericalNavigationExtension();

    expect(extension.previous()).toBe("3");
    expect(extension.next()).toBe("7");
  });

  test("the range is bounded by the book's own end", () => {
    numbered("/Genesis/49/to/50");

    expect(numericalNavigationExtension().hasNext()).toBe(false);
    expect(books.Genesis.end).toBe("50");
  });

  test("there is a next section while inside the book", () => {
    numbered("/Genesis/4");

    expect(numericalNavigationExtension().hasNext()).toBe(true);
  });

  test("hebrew titles are hebrew numerals", () => {
    const renderer = new ConfigurableRenderer(
      "tanakh", numericalNavigationExtension(), {allowCompactLayout: true}, "Tanakh");
    numbered("/Genesis/4");

    expect(renderer.newNumericalPageTitleHebrew("4")).toBe("בראשית ד");
  });

  test("english titles are the book name and section", () => {
    const renderer = new ConfigurableRenderer(
      "tanakh", numericalNavigationExtension(), {allowCompactLayout: true}, "Tanakh");
    numbered("/Genesis/4");

    expect(renderer.newPageTitle("4")).toBe("Genesis 4");
  });
});

describe("Talmud page titles", () => {
  test("a daf is formatted with its amud as a subscript", () => {
    expect(makeAmudSmall(formatDafInHebrew("ברכות", "2a"))).toBe('ברכות ב<sub>ע"א</sub>');
  });

  test("the second side of the daf uses bet", () => {
    expect(makeAmudSmall(formatDafInHebrew("ברכות", "2b"))).toBe('ברכות ב<sub>ע"ב</sub>');
  });

  test("english titles use the masechet name", () => {
    const renderer = new ConfigurableRenderer(
      "talmud", numericalNavigationExtension(), {isTalmud: true}, "Talmud");

    expect(renderer.newPageTitle("2a")).toBe("Berakhot 2a");
  });
});

describe("other books' hebrew title formats", () => {
  test("Peninei Halacha titles are formatted with its own helper", () => {
    expect(penineiHalachaHebrewTitleName("פניני הלכה", "3")).toEqual(expect.any(String));
    expect(penineiHalachaHebrewTitleName("פניני הלכה", "3")).toContain("פניני הלכה");
  });

  test("Mishneh Torah titles are formatted with its own helper", () => {
    expect(mishnehTorahHebrewTitleName("הלכות תשובה", "3")).toContain("הלכות תשובה");
  });
});

describe("compact layout is a per-renderer choice", () => {
  const threeSegments = (): UiPage => page({
    id: "2a",
    sections: [
      segment({ref: "a", he: "א"}),
      segment({ref: "b", he: "ב"}),
      segment({ref: "c", he: "ג"}),
    ],
  });

  test("Talmud and Tanakh allow it", () => {
    localStorage.layoutOption = "compact";
    const app = mountRenderer([threeSegments()], {allowCompactLayout: true});

    expect(app.all(".segment-container")).toHaveLength(1);
  });

  test("Mishna, Mishneh Torah, Shulchan Arukh and Peninei Halacha do not", () => {
    localStorage.layoutOption = "compact";
    const app = mountRenderer([threeSegments()], {allowCompactLayout: false});

    expect(app.all(".segment-container")).toHaveLength(3);
  });
});

describe("versions are per-renderer", () => {
  test("a renderer with no versions offers none", () => {
    const renderer = new ConfigurableRenderer(
      "mishna", numericalNavigationExtension(), {}, "Mishna");

    expect(renderer.versions()).toEqual([]);
  });

  test("Tanakh offers its unvocalized version", () => {
    const renderer = new ConfigurableRenderer(
      "tanakh", numericalNavigationExtension(), {}, "Tanakh", undefined,
      [{hebrew: "טקסט ללא ניקוד", english: "Unvocalized"}]);

    expect(renderer.versions().map(x => x.english)).toEqual(["Unvocalized"]);
  });

  test("the preferred-version key is scoped per renderer type", () => {
    // Two renderers reading the same setting name would let a Talmud preference leak into Tanakh.
    localStorage.preferredVersion_Tanakh = "Unvocalized";
    const tanakh = new ConfigurableRenderer(
      "tanakh", numericalNavigationExtension(), {}, "Tanakh");
    const talmud = new ConfigurableRenderer(
      "talmud", numericalNavigationExtension(), {isTalmud: true}, "Talmud");

    const versionedPage = () => page({
      sections: [segment({
        ref: "1:1",
        he: "מקורי",
        sourceRef: "Original",
        commentary: commentaries({
          Versions: [{ref: "v", he: "אחר", en: "other", sourceRef: "Unvocalized"}],
        }),
      })],
    });

    const forTanakh = versionedPage();
    tanakh._applyClientSideDataTransformations(forTanakh);
    const forTalmud = versionedPage();
    talmud._applyClientSideDataTransformations(forTalmud);

    expect(forTanakh.sections[0].he).toBe("אחר");
    expect(forTalmud.sections[0].he).toBe("מקורי");
  });
});

describe("the liturgy renderer", () => {
  test("its english title turns underscores back into spaces", () => {
    const renderer = new LiturgyRenderer();

    expect(renderer.newPageTitle("Birkat_Hamazon")).toBe("Birkat Hamazon");
  });

  test("it identifies itself as Liturgy, so its version key is its own", () => {
    expect(new LiturgyRenderer().rendererType()).toBe("Liturgy");
  });

  test("it declares no versions", () => {
    expect(new LiturgyRenderer().versions()).toEqual([]);
  });

  test("navigation is disabled, so there is nothing to load next", () => {
    const renderer = new LiturgyRenderer();

    expect(renderer.navigationExtension.hasNext()).toBe(false);
    expect(renderer.navigationExtension.hasPrevious()).toBe(false);
    expect((renderer.navigationExtension as any).disableNavigation).toBe(true);
  });

  test("it forces the expandable translation layout regardless of the stored setting", () => {
    localStorage.translationOption = "english-side-by-side";
    const renderer = new LiturgyRenderer();

    expect(renderer.translationOption()).toBe("both");
  });

  test("hebrew as the site language still wins over its override", () => {
    localStorage.languageOption = "hebrew";
    const renderer = new LiturgyRenderer();

    expect(renderer.translationOption()).toBe("just-hebrew");
  });

  test("every segment gets a synthetic translation, since it is not talmud", () => {
    const renderer = new LiturgyRenderer();
    const target = page({
      sections: [segment({ref: "Siddur 1", he: "עברית", en: "the english"})],
    });

    renderer._applyClientSideDataTransformations(target);

    expect(target.sections[0].commentary!.Translation.comments[0].en).toBe("the english");
  });

  describe("its expand-translation-on-expansion option", () => {
    // The liturgy renderer is the only caller of this option, and it never takes effect:
    // `Renderer` publishes it as `expandTranslationOnMergedSectionExpansion` while `Segment`
    // reads `expandTranslationOnMergedSegmentExpansion` — Section versus Segment. Recorded as
    // Observation #10 in FrontendTestingPlan.md.
    const withTranslation = () => segment({
      ref: "Siddur 1",
      he: "עברית",
      en: "english",
      commentary: commentaries({Translation: [{ref: "t", he: "תרגום", en: "the translation"}]}),
    });

    const renderExpandedSegment = (contextOverrides: Record<string, unknown>) => mount(
      <TestContext overrides={contextOverrides as any}>
        <Segment
          segments={[withTranslation()]}
          segmentLabel="s_section_1"
          toggleMerging={() => {}}
          isExpanded
          lastUnexpandedUuid={undefined}
          />
      </TestContext>,
    );

    test("the option is published on the configuration under the Section spelling", () => {
      const renderer = new LiturgyRenderer();

      expect(renderer.expandTranslationOnMergedSectionExpansion).toBe(true);
    });

    test("Segment ignores the Section spelling, so the option does nothing", () => {
      const root = renderExpandedSegment({expandTranslationOnMergedSectionExpansion: true});

      expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual([]);
    });

    test("Segment does honor the Segment spelling, which nothing sets", () => {
      const root = renderExpandedSegment({expandTranslationOnMergedSegmentExpansion: true});

      expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual(["תרגום"]);
    });

    test("an unexpanded segment never opens the translation either way", () => {
      const root = mount(
        <TestContext overrides={{expandTranslationOnMergedSegmentExpansion: true} as any}>
          <Segment
            segments={[withTranslation()]}
            segmentLabel="s_section_1"
            toggleMerging={() => {}}
            isExpanded={false}
            lastUnexpandedUuid={undefined}
            />
        </TestContext>,
      );

      expect(texts(root, ".IndividualComment .table-cell.hebrew")).toEqual([]);
    });
  });
});

describe("renderer-specific section filtering", () => {
  // Birkat Hamazon and the Siddur override `ignoredSectionRefs` to drop refs that do not apply to
  // today's date, and `sortedAmudim` to drop whole sections. The date logic lives in
  // hebrew_calendar.ts; what the renderer contributes is the filtering itself.
  test("ignored refs are dropped from the rendered page", () => {
    const app = mountRenderer(
      [page({
        id: "2a",
        sections: [
          segment({ref: "Birkat HaMazon 25", he: "על הניסים"}),
          segment({ref: "Birkat HaMazon 26", he: "רגיל"}),
        ],
      })],
      {ignoredSectionRefs: ["Birkat HaMazon 25"]});

    expect(app.textsOf(".gemara-container .table-cell.hebrew")).toEqual(["רגיל"]);
  });

  test("dropping every ref leaves an empty page rather than an error", () => {
    const app = mountRenderer(
      [page({id: "2a", sections: [segment({ref: "only", he: "טקסט"})]})],
      {ignoredSectionRefs: ["only"]});

    expect(app.all(".segment-container")).toHaveLength(0);
    expect(app.all(".amudContainer")).toHaveLength(1);
  });
});
