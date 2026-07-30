/**
 * The language and translation settings, which together drive more branching than anything else
 * in the frontend.
 *
 * Two independent settings interact:
 *   - `localStorage.languageOption` ∈ {hebrew, mix, english} — the site's own language, and a
 *     hard override that removes english from the reading surface entirely.
 *   - `localStorage.translationOption` ∈ {english-side-by-side, both, just-hebrew} — how the
 *     translation of the text is laid out.
 *
 * `Renderer` collapses them into one resolved value, and roughly a dozen components then read
 * either the resolved value or `languageOption` directly. The tests below cover the resolution
 * itself, then every reading surface it reaches.
 */
import * as React from "react";
import {Renderer, numericalNavigationExtension} from "../Renderer";
import {IndividualComment} from "../IndividualComment";
import Modal from "../Modal";
import {getCommentaryTypes} from "../commentaryTypes";
import {CommentaryType} from "../../commentaries";
import {MountedRenderer, mountRenderer} from "./testing/renderer_harness";
import {TestContext} from "./testing/configuration";
import {
  click,
  doubleClick,
  mount,
  query,
  texts,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";
import {comment, commentaries, page, resetFixtureCounter, segment} from "./testing/fixtures";

beforeEach(() => {
  installPageEnvironment({book: "Berakhot", path: "/Berakhot/2a"});
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  document.getElementById("main-contents")?.remove();
  clearPageEnvironment();
});

class ResolutionRenderer extends Renderer {
  constructor(options = {}) {
    super(getCommentaryTypes("talmud"), numericalNavigationExtension() as any, options);
  }

  newPageTitleHebrew(section: string): string {
    return section;
  }

  rendererType(): string {
    return "Talmud";
  }
}

describe("resolving the two settings into one translation option", () => {
  const resolve = (options = {}) => new ResolutionRenderer(options).translationOption();

  test("defaults to side by side when nothing is set", () => {
    expect(resolve()).toBe("english-side-by-side");
  });

  test("uses the stored translation option", () => {
    localStorage.translationOption = "both";

    expect(resolve()).toBe("both");
  });

  test("a renderer's override beats the stored option", () => {
    localStorage.translationOption = "english-side-by-side";

    expect(resolve({translationOverride: "both"})).toBe("both");
  });

  test("hebrew as the site language forces just-hebrew, whatever else is set", () => {
    localStorage.languageOption = "hebrew";

    for (const stored of ["english-side-by-side", "both", "just-hebrew", undefined]) {
      if (stored) localStorage.translationOption = stored;
      else delete localStorage.translationOption;
      expect(resolve()).toBe("just-hebrew");
      expect(resolve({translationOverride: "both"})).toBe("just-hebrew");
    }
  });

  test("the other language options do not override anything", () => {
    localStorage.translationOption = "both";

    for (const language of ["mix", "english"]) {
      localStorage.languageOption = language;
      expect(resolve()).toBe("both");
    }
  });

  test("the resolution is re-read on every call, not captured once", () => {
    // Components call `context.translationOption()` during render, so flipping the setting must
    // take effect without rebuilding the renderer.
    const renderer = new ResolutionRenderer();
    expect(renderer.translationOption()).toBe("english-side-by-side");

    localStorage.languageOption = "hebrew";

    expect(renderer.translationOption()).toBe("just-hebrew");
  });
});

const pageWithTranslation = () => page({
  id: "2a",
  sections: [segment({
    ref: "Berakhot 2a:1",
    he: "מאימתי",
    en: "From when",
    commentary: commentaries({
      Steinsaltz: [{ref: "Steinsaltz 2a:1", he: "שטיינזלץ", en: "steinsaltz english"}],
      Rashi: [{ref: "Rashi 2a:1", he: 'רש"י', en: "rashi english"}],
    }),
  })],
});

const gemaraHebrew = (app: MountedRenderer) => (
  app.textsOf(".gemara-container .table-cell.hebrew"));
const gemaraEnglish = (app: MountedRenderer) => (
  app.textsOf(".gemara-container .table-cell.english"));

describe("side-by-side mode", () => {
  const mountSideBySide = () => mountRenderer([pageWithTranslation()], {isTalmud: true});

  test("shows hebrew and english together in the gemara row", () => {
    const app = mountSideBySide();

    expect(gemaraHebrew(app)).toEqual(["מאימתי"]);
    expect(gemaraEnglish(app)).toEqual(["From when"]);
  });

  test("uses the english page title, left to right", () => {
    const app = mountSideBySide();

    const title = app.find(".title");
    expect(title.textContent).toContain("Berakhot 2a");
    expect(title.getAttribute("dir")).toBe("ltr");
  });

  test("Steinsaltz has no button of its own unless the translation button is enabled", () => {
    // Steinsaltz's className is "translation", so `shouldHide` suppresses its button in every
    // mode until `showTranslationButton` is set.
    const app = mountSideBySide();

    expect(app.findOrNull("a.translation")).toBeNull();
    expect(app.textsOf(".show-buttons a.commentary_header")).toEqual(['רש"י']);
  });

  test("enabling the translation button reveals Steinsaltz under its own name", () => {
    localStorage.showTranslationButton = "yes";
    const app = mountSideBySide();

    expect(app.textsOf(".show-buttons a.commentary_header")).toContain("שטיינזלץ");
  });

  test("the search bar prompts in english", () => {
    const app = mountSideBySide();

    click(app.find("#showSearch button"));

    expect(app.find(".inPageSearchBar").getAttribute("placeholder")).toBe("Search...");
    expect(app.find(".snackbar").getAttribute("dir")).toBe("ltr");
  });
});

describe("expandable ('both') mode", () => {
  const mountBoth = () => {
    localStorage.translationOption = "both";
    return mountRenderer([pageWithTranslation()], {isTalmud: true});
  };

  test("the gemara row carries no english of its own", () => {
    const app = mountBoth();

    expect(gemaraHebrew(app)).toEqual(["מאימתי"]);
    expect(gemaraEnglish(app)).toEqual([]);
  });

  test("Steinsaltz becomes the translation", () => {
    localStorage.showTranslationButton = "yes";
    const app = mountBoth();

    click(app.find(".show-buttons a.translation"));

    expect(app.textsOf(".IndividualComment .table-cell.hebrew")).toEqual(["שטיינזלץ"]);
  });

  test("the translation is reachable by double click even with no button", () => {
    const app = mountBoth();
    expect(app.findOrNull(".show-buttons a.translation")).toBeNull();

    doubleClick(app.find(".gemara-container .table-cell.hebrew"));

    expect(app.textsOf(".IndividualComment .table-cell.hebrew")).toEqual(["שטיינזלץ"]);
  });

  test("uses the hebrew page title, right to left", () => {
    const app = mountBoth();

    const title = app.find(".titleHebrew");
    expect(title.textContent).toContain("ברכות");
    expect(title.getAttribute("dir")).toBe("rtl");
  });

  test("the search bar prompts in hebrew, since the reading surface is hebrew", () => {
    const app = mountBoth();

    click(app.find("#showSearch button"));

    expect(app.find(".inPageSearchBar").getAttribute("placeholder")).toBe("חפש...");
    expect(app.find(".snackbar").getAttribute("dir")).toBe("rtl");
  });

  test("english is still rendered inside commentaries", () => {
    const app = mountBoth();

    click(app.find(".show-buttons a.rashi"));

    expect(app.textsOf(".IndividualComment .table-cell.english")).toEqual(["rashi english"]);
  });
});

describe("just-hebrew mode", () => {
  const mountJustHebrew = () => {
    localStorage.translationOption = "just-hebrew";
    return mountRenderer([pageWithTranslation()], {isTalmud: true});
  };

  test("the gemara row carries no english", () => {
    const app = mountJustHebrew();

    expect(gemaraHebrew(app)).toEqual(["מאימתי"]);
    expect(gemaraEnglish(app)).toEqual([]);
  });

  test("Steinsaltz is not converted into a translation", () => {
    localStorage.showTranslationButton = "yes";
    const app = mountJustHebrew();

    // Still labelled as Steinsaltz rather than as the translation, unlike in 'both' mode.
    expect(app.textsOf(".show-buttons a.commentary_header")).toContain("שטיינזלץ");
  });

  test("uses the hebrew page title", () => {
    const app = mountJustHebrew();

    expect(app.findOrNull(".title")).toBeNull();
    expect(app.find(".titleHebrew").textContent).toContain("ברכות");
  });
});

describe("hebrew as the site language", () => {
  const mountHebrewSite = (extra: () => void = () => {}) => {
    localStorage.languageOption = "hebrew";
    extra();
    return mountRenderer([pageWithTranslation()], {isTalmud: true});
  };

  test("no english cell is rendered anywhere on the page", () => {
    const app = mountHebrewSite();
    click(app.find(".show-buttons a.rashi"));

    expect(app.all(".table-cell.english")).toHaveLength(0);
  });

  test("english is dropped even when side-by-side is explicitly stored", () => {
    const app = mountHebrewSite(() => {
      localStorage.translationOption = "english-side-by-side";
    });

    expect(app.all(".table-cell.english")).toHaveLength(0);
  });

  test("hebrew text takes the full row", () => {
    const app = mountHebrewSite();

    expect([...app.find(".gemara-container .table-cell.hebrew").classList])
      .toContain("fullRow");
  });

  test("the load buttons are labelled in hebrew", () => {
    const app = mountHebrewSite();

    const labels = app.all(".navigation-button-container span[role=button]")
      .map(x => x.textContent ?? "");
    expect(labels.every(x => x.startsWith("לטעון"))).toBe(true);
  });

  test("the load buttons read right to left", () => {
    const app = mountHebrewSite();

    expect(app.find(".navigation-button-container").getAttribute("dir")).toBe("rtl");
  });

  test("english-only commentaries are hidden", () => {
    const ENGLISH_ONLY: CommentaryType = {
      englishName: "Community Translation",
      hebrewName: "תרגום קהילתי",
      className: "community-translation",
      ignoreInHebrew: true,
    };
    localStorage.languageOption = "hebrew";
    const app = mountRenderer(
      [page({
        id: "2a",
        sections: [segment({
          ref: "Berakhot 2a:1",
          he: "מאימתי",
          commentary: commentaries({
            "Community Translation": [{he: "", en: "community"}],
            Rashi: [{he: 'רש"י'}],
          }),
        })],
      })],
      {isTalmud: true, commentaryTypes: [ENGLISH_ONLY, ...getCommentaryTypes("talmud")]});

    expect(app.textsOf(".show-buttons a.commentary_header")).not.toContain("תרגום קהילתי");
    expect(app.textsOf(".show-buttons a.commentary_header")).toContain('רש"י');
  });

  test("an english-only image does not raise the image indicator", () => {
    localStorage.languageOption = "hebrew";
    const app = mountRenderer([page({
      id: "2a",
      sections: [segment({
        ref: "Berakhot 2a:1",
        he: "מאימתי",
        commentary: commentaries({Rashi: [{he: 'רש"י', en: "<img src='x.png'>"}]}),
      })],
    })], {isTalmud: true});

    expect(app.find(".show-buttons").textContent).not.toContain("📸");
  });

  test("a hebrew image still raises the image indicator", () => {
    localStorage.languageOption = "hebrew";
    const app = mountRenderer([page({
      id: "2a",
      sections: [segment({
        ref: "Berakhot 2a:1",
        he: "מאימתי",
        commentary: commentaries({Rashi: [{he: "<img src='x.png'>", en: ""}]}),
      })],
    })], {isTalmud: true});

    expect(app.find(".show-buttons").textContent).toContain("📸");
  });

  test("modal buttons are labelled in hebrew", () => {
    localStorage.languageOption = "hebrew";
    const container = mount(
      <Modal
        content={<span>content</span>}
        cancelText="Cancel"
        cancelTextHebrew="בטל"
        onCancel={() => {}}
        acceptText="Submit"
        acceptTextHebrew="שלח"
        onAccept={() => {}} />,
    );

    expect(texts(container, "button")).toEqual(expect.arrayContaining(["בטל", "שלח"]));
    expect(texts(container, "button")).not.toContain("Cancel");
  });

  test("modal buttons are labelled in english otherwise", () => {
    const container = mount(
      <Modal
        content={<span>content</span>}
        cancelText="Cancel"
        cancelTextHebrew="בטל"
        onCancel={() => {}}
        acceptText="Submit"
        acceptTextHebrew="שלח"
        onAccept={() => {}} />,
    );

    expect(texts(container, "button")).toEqual(expect.arrayContaining(["Cancel", "Submit"]));
  });
});

describe("the translation button setting", () => {
  test("Steinsaltz leads the commentary order when the button is hidden", () => {
    const types = getCommentaryTypes("talmud");

    expect(types[0].englishName).toBe("Steinsaltz");
  });

  test("Steinsaltz moves to the end when the button is shown", () => {
    localStorage.showTranslationButton = "yes";
    const types = getCommentaryTypes("talmud");

    expect(types[0].englishName).not.toBe("Steinsaltz");
    expect(types.map(x => x.englishName)).toContain("Steinsaltz");
  });

  test("only talmud and mishneh torah get Steinsaltz at all", () => {
    for (const resourceType of ["talmud", "mishneh torah"] as const) {
      expect(getCommentaryTypes(resourceType).map(x => x.englishName)).toContain("Steinsaltz");
    }
    for (const resourceType of ["siddur", "tanakh", "mishna"] as const) {
      expect(getCommentaryTypes(resourceType).map(x => x.englishName)).not.toContain("Steinsaltz");
    }
  });

  test("every resource type ends with personal notes", () => {
    for (const resourceType of
      ["siddur", "tanakh", "talmud", "mishna", "mishneh torah"] as const) {
      expect(getCommentaryTypes(resourceType).at(-1)!.englishName).toBe("Personal Notes");
    }
  });

  test("the translation button is hidden on the page unless enabled", () => {
    localStorage.translationOption = "both";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    expect(app.findOrNull(".show-buttons a.translation")).toBeNull();
  });

  test("the translation button appears on the page when enabled", () => {
    localStorage.translationOption = "both";
    localStorage.showTranslationButton = "yes";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    expect(app.findOrNull(".show-buttons a.translation")).not.toBeNull();
  });
});

describe("hiding the gemara translation by default", () => {
  const TRANSLATION: CommentaryType = {
    englishName: "Translation",
    hebrewName: "תרגום",
    className: "translation",
  };

  const renderTranslationComment = () => mount(
    <TestContext>
      <IndividualComment
        comment={comment({ref: "t", he: "שטיינזלץ", en: "the translation"})}
        commentaryKind={TRANSLATION} />
    </TestContext>,
  );

  test("the english is withheld until the hebrew is double clicked", () => {
    localStorage.translationOption = "both";
    localStorage.hideGemaraTranslationByDefault = "true";
    const root = renderTranslationComment();

    expect(texts(root, ".table-cell.english")).toEqual([]);

    doubleClick(query(root, ".table-cell.hebrew"));

    expect(texts(root, ".table-cell.english")).toEqual(["the translation"]);
  });

  test("double clicking again hides it", () => {
    localStorage.translationOption = "both";
    localStorage.hideGemaraTranslationByDefault = "true";
    const root = renderTranslationComment();
    doubleClick(query(root, ".table-cell.hebrew"));

    doubleClick(query(root, ".table-cell.hebrew"));

    expect(texts(root, ".table-cell.english")).toEqual([]);
  });

  test("the english is shown immediately when the setting is off", () => {
    localStorage.translationOption = "both";
    const root = renderTranslationComment();

    expect(texts(root, ".table-cell.english")).toEqual(["the translation"]);
  });

  test("the setting has no effect outside 'both' mode", () => {
    localStorage.hideGemaraTranslationByDefault = "true";
    const root = renderTranslationComment();

    expect(texts(root, ".table-cell.english")).toEqual(["the translation"]);
  });

  test("the setting only applies to the Translation commentary", () => {
    localStorage.translationOption = "both";
    localStorage.hideGemaraTranslationByDefault = "true";
    const root = mount(
      <TestContext>
        <IndividualComment
          comment={comment({ref: "r", he: 'רש"י', en: "rashi english"})}
          commentaryKind={{englishName: "Rashi", hebrewName: 'רש"י', className: "rashi"}} />
      </TestContext>,
    );

    expect(texts(root, ".table-cell.english")).toEqual(["rashi english"]);
  });
});

describe("expanding english by default", () => {
  test("gemara rows start expanded when the setting is on", () => {
    localStorage.expandEnglishByDefault = "true";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    expect([...app.find(".gemara-container .table-cell.english").classList])
      .not.toContain("lineClamped");
  });

  test("gemara rows start clamped by default", () => {
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    expect([...app.find(".gemara-container .table-cell.english").classList])
      .toContain("lineClamped");
  });

  test("the setting reaches the gemara translation opened by double click", () => {
    localStorage.translationOption = "both";
    localStorage.expandEnglishByDefault = "true";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    doubleClick(app.find(".gemara-container .table-cell.hebrew"));

    const english = app.all(".IndividualComment .table-cell.english");
    expect(english).toHaveLength(1);
    expect([...english[0].classList]).not.toContain("lineClamped");
  });

  test("the setting does not reach other commentaries", () => {
    localStorage.expandEnglishByDefault = "true";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    click(app.find(".show-buttons a.rashi"));

    expect([...app.find(".IndividualComment .table-cell.english").classList])
      .toContain("lineClamped");
  });
});

describe("wrapping translations", () => {
  // jsdom reports every height as 0, so the wrap decision always lands on its "cannot measure"
  // branch and `shouldWrap` is false. What remains observable is that an expanded english cell is
  // marked as never wrapping, in both settings.
  test("an expanded english cell does not wrap when measurement is unavailable", () => {
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    doubleClick(app.find(".gemara-container .table-cell.english"));

    expect([...app.find(".gemara-container .table-cell.english").classList])
      .toContain("neverWrap");
  });

  test("turning wrapping off keeps the same layout", () => {
    localStorage.wrapTranslations = "false";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    doubleClick(app.find(".gemara-container .table-cell.english"));

    expect([...app.find(".gemara-container .table-cell.english").classList])
      .toContain("neverWrap");
  });
});

describe("numeric navigation labels", () => {
  // A numbered book rather than a masechet: `amudMetadata` only parses "4" as a section for
  // books that are not laid out by daf.
  const numericBook = () => installPageEnvironment({book: "Genesis", path: "/Genesis/4/to/6"});

  test("are plain numbers in english", () => {
    numericBook();
    const extension = numericalNavigationExtension();

    expect(extension.displayPrevious()).toBe("3");
    expect(extension.displayNext()).toBe("7");
  });

  test("become hebrew numerals with a chapter prefix in hebrew", () => {
    numericBook();
    localStorage.languageOption = "hebrew";
    const extension = numericalNavigationExtension();

    expect(extension.displayPrevious()).toBe("פרק ג");
    expect(extension.displayNext()).toBe("פרק ז");
  });

  test("use the renderer's own prefix", () => {
    numericBook();
    localStorage.languageOption = "hebrew";
    const extension = numericalNavigationExtension("סימן");

    expect(extension.displayPrevious()).toBe("סימן ג");
  });

  test("the underlying values stay numeric regardless of language", () => {
    numericBook();
    localStorage.languageOption = "hebrew";
    const extension = numericalNavigationExtension();

    expect(extension.previous()).toBe("3");
    expect(extension.next()).toBe("7");
  });

  test("the first section has nothing before it", () => {
    installPageEnvironment({book: "Genesis", path: "/Genesis/1"});

    expect(numericalNavigationExtension().hasPrevious()).toBe(false);
  });

  test("the last section of the book has nothing after it", () => {
    installPageEnvironment({book: "Genesis", path: "/Genesis/50"});

    expect(numericalNavigationExtension().hasNext()).toBe(false);
  });
});

/**
 * `Steinsaltz` and `Translation` are two different commentary kinds that share the className
 * "translation". `commentaryTypesByClassName` is a last-one-wins map, and `getCommentaryTypes`
 * changes their relative order depending on `showTranslationButton` — so which kind the gemara
 * translation renders as flips with that setting. Two other preferences are gated on
 * `commentaryKind.englishName === "Translation"`, and therefore stop working when the translation
 * button is enabled. Recorded in FrontendTestingPlan.md under Observations, "Enabling
 * \"Show Translation Button\" silently disables two other preferences".
 */
describe("the Steinsaltz / Translation className collision", () => {
  const kindForTranslation = () => {
    const types = getCommentaryTypes("talmud");
    const byClassName: Record<string, CommentaryType> = {};
    for (const type of types) byClassName[type.className] = type;
    return byClassName.translation;
  };

  test("both kinds claim the same className", () => {
    const types = getCommentaryTypes("talmud");
    const claiming = types.filter(x => x.className === "translation").map(x => x.englishName);

    expect(claiming.sort()).toEqual(["Steinsaltz", "Translation"]);
  });

  test("Translation wins the lookup by default", () => {
    expect(kindForTranslation().englishName).toBe("Translation");
  });

  test("Steinsaltz wins it once the translation button is enabled", () => {
    localStorage.showTranslationButton = "yes";

    expect(kindForTranslation().englishName).toBe("Steinsaltz");
  });

  test("expand-english-by-default stops applying when the button is enabled", () => {
    localStorage.translationOption = "both";
    localStorage.expandEnglishByDefault = "true";
    localStorage.showTranslationButton = "yes";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    click(app.find(".show-buttons a.translation"));

    // Would be expanded if the kind had resolved to Translation.
    expect([...app.find(".IndividualComment .table-cell.english").classList])
      .toContain("lineClamped");
  });

  test("hide-gemara-translation stops applying when the button is enabled", () => {
    localStorage.translationOption = "both";
    localStorage.hideGemaraTranslationByDefault = "true";
    localStorage.showTranslationButton = "yes";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    click(app.find(".show-buttons a.translation"));

    // Would be withheld until a double click if the kind had resolved to Translation.
    expect(app.textsOf(".IndividualComment .table-cell.english"))
      .toEqual(["steinsaltz english"]);
  });

  test("hide-gemara-translation does apply when the button is not enabled", () => {
    localStorage.translationOption = "both";
    localStorage.hideGemaraTranslationByDefault = "true";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    doubleClick(app.find(".gemara-container .table-cell.hebrew"));

    expect(app.textsOf(".IndividualComment .table-cell.english")).toEqual([]);
  });

  test("the button and the opened commentary resolve their kind differently", () => {
    // This is the mechanism behind the two tests above. The *button* comes from
    // `forEachCommentary`, which matches on `englishName` against the commentary map key — in
    // 'both' mode that key is "Translation", so the button is the Translation kind. The *opened*
    // commentary comes from `commentaryTypesByClassName`, where Steinsaltz has overwritten
    // Translation. One commentary, two different kinds, depending on which side you look at.
    localStorage.translationOption = "both";
    localStorage.showTranslationButton = "yes";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});

    expect(app.find(".show-buttons a.translation").textContent).toBe("Translation");
    expect(kindForTranslation().englishName).toBe("Steinsaltz");
  });
});

describe("switching language mid-session", () => {
  test("the page re-renders in hebrew when the setting changes", () => {
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});
    expect(app.all(".table-cell.english")).toHaveLength(1);

    localStorage.languageOption = "hebrew";
    app.setPage(pageWithTranslation());

    expect(app.all(".table-cell.english")).toHaveLength(0);
    expect(app.findOrNull(".title")).toBeNull();
    expect(app.findOrNull(".titleHebrew")).not.toBeNull();
  });

  test("switching back to english restores the translation", () => {
    localStorage.languageOption = "hebrew";
    const app = mountRenderer([pageWithTranslation()], {isTalmud: true});
    expect(app.all(".table-cell.english")).toHaveLength(0);

    delete localStorage.languageOption;
    app.setPage(pageWithTranslation());

    expect(app.textsOf(".gemara-container .table-cell.english")).toEqual(["From when"]);
  });
});
