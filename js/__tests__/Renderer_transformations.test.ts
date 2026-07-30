/**
 * Tests for `Renderer._applyClientSideDataTransformations`, the data rewriting that happens on
 * every render between the API response and the React tree.
 *
 * It mutates its input in place and is re-run on each render, so several tests here check
 * behavior across repeated invocations rather than a single call.
 */
import {Renderer} from "../Renderer";
import {getCommentaryTypes} from "../commentaryTypes";
import {UiPage} from "../Page";
import {commentaries, page, resetFixtureCounter, segment} from "./testing/fixtures";
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
}

function transform(target: UiPage, renderer = new TestRenderer({isTalmud: true})): UiPage {
  renderer._applyClientSideDataTransformations(target);
  return target;
}

beforeEach(() => {
  installPageEnvironment();
  resetFixtureCounter();
});
afterEach(clearPageEnvironment);

describe("segment defaults", () => {
  test("a page with no sections gets an empty list rather than throwing", () => {
    const target = transform({id: "2a", title: "t", titleHebrew: "ת"} as UiPage);

    expect(target.sections).toEqual([]);
  });

  test("segments without a uuid are given one and marked as the default version", () => {
    const target = transform(page({
      sections: [{ref: "Berakhot 2a:1", he: "עברית", en: "english"} as any],
    }));

    const [only] = target.sections;
    expect(only.uuid).toMatch(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/);
    expect(only.sourceRef).toBe("default");
    expect(only.sourceHeRef).toBe("ברירת מחדל");
  });

  test("existing uuids are preserved across repeated transformations", () => {
    const target = page();
    const uuids = target.sections.map(x => x.uuid);

    transform(target);
    transform(target);

    expect(target.sections.map(x => x.uuid)).toEqual(uuids);
  });
});

describe("preferred version substitution", () => {
  const pageWithVersions = () => page({
    sections: [segment({
      ref: "Berakhot 2a:1",
      he: "עברית של וילנא",
      en: "vilna english",
      sourceRef: "Vilna Shas",
      sourceHeRef: 'ש"ס וילנא',
      commentary: commentaries({
        Versions: [{
          ref: "version-ref",
          he: "עברית של דוידסון",
          en: "davidson english",
          sourceRef: "William Davidson Edition",
          sourceHeRef: "מהדורת ויליאם דוידסון",
        }],
      }),
    })],
  });

  test("the preferred version replaces the segment text", () => {
    localStorage.preferredVersion_TestRenderer = "William Davidson Edition";

    const target = transform(pageWithVersions());

    const [only] = target.sections;
    expect(only.he).toBe("עברית של דוידסון");
    expect(only.en).toBe("davidson english");
    expect(only.sourceRef).toBe("William Davidson Edition");
    expect(only.sourceHeRef).toBe("מהדורת ויליאם דוידסון");
  });

  test("the displaced text becomes a version comment, so it stays reachable", () => {
    localStorage.preferredVersion_TestRenderer = "William Davidson Edition";

    const target = transform(pageWithVersions());

    const [displaced] = target.sections[0].commentary!.Versions.comments;
    expect(displaced.sourceRef).toBe("Vilna Shas");
    expect(displaced.he).toBe("עברית של וילנא");
    expect(displaced.en).toBe("vilna english");
    expect(displaced.ref).toBe("version-ref");
  });

  test("nothing happens when the preferred version is already the segment's version", () => {
    localStorage.preferredVersion_TestRenderer = "Vilna Shas";

    const target = transform(pageWithVersions());

    expect(target.sections[0].he).toBe("עברית של וילנא");
    expect(target.sections[0].commentary!.Versions.comments[0].sourceRef)
      .toBe("William Davidson Edition");
  });

  test("nothing happens when no preferred version is set", () => {
    const target = transform(pageWithVersions());

    expect(target.sections[0].he).toBe("עברית של וילנא");
  });

  test("an unavailable preferred version leaves the versions list intact", () => {
    localStorage.preferredVersion_TestRenderer = "Some Missing Edition";

    const target = transform(pageWithVersions());

    expect(target.sections[0].he).toBe("עברית של וילנא");
    expect(target.sections[0].commentary!.Versions.comments.map(x => x.sourceRef))
      .toEqual(["William Davidson Edition"]);
  });

  test("the preferred version key is scoped to the renderer type", () => {
    localStorage.preferredVersion_Talmud = "William Davidson Edition";

    const target = transform(pageWithVersions());

    expect(target.sections[0].he).toBe("עברית של וילנא");
  });
});

describe("side-by-side ('both') translation mode", () => {
  const bothModeRenderer = () => {
    localStorage.translationOption = "both";
    return new TestRenderer({isTalmud: true});
  };

  const withSteinsaltz = (en = "steinsaltz english") => page({
    sections: [segment({
      ref: "Berakhot 2a:1",
      he: "עברית",
      en: "gemara english",
      commentary: commentaries({
        Steinsaltz: [{ref: "Steinsaltz on Berakhot 2a:1", he: "שטיינזלץ", en}],
      }),
    })],
  });

  test("Steinsaltz is renamed to Translation so it renders as the translation", () => {
    const target = transform(withSteinsaltz(), bothModeRenderer());

    const {commentary} = target.sections[0];
    expect(commentary!.Steinsaltz).toBeUndefined();
    expect(commentary!.Translation.comments[0].he).toBe("שטיינזלץ");
    expect(target.sections[0].steinsaltzRetained).toBe(true);
  });

  test("Steinsaltz is left alone in the default translation mode", () => {
    const target = transform(withSteinsaltz());

    expect(Object.keys(target.sections[0].commentary!)).toEqual(["Steinsaltz"]);
    expect(target.sections[0].steinsaltzRetained).toBeUndefined();
  });

  test("an empty Steinsaltz english is continually refreshed from the segment", () => {
    // Steinsaltz rows sometimes carry no english of their own; in that case the gemara's own
    // english is shown, and must be re-copied on every pass because highlighting rewrites it.
    const renderer = bothModeRenderer();
    const target = transform(withSteinsaltz(""), renderer);
    expect(target.sections[0].continuallyRewriteSteinsaltzEnglish).toBe(true);

    target.sections[0].en = "gemara english, now highlighted";
    transform(target, renderer);

    expect(target.sections[0].commentary!.Translation.comments[0].en)
      .toBe("gemara english, now highlighted");
  });

  test("a non-empty Steinsaltz english is not overwritten on later passes", () => {
    const renderer = bothModeRenderer();
    const target = transform(withSteinsaltz(), renderer);
    expect(target.sections[0].continuallyRewriteSteinsaltzEnglish).toBe(false);

    target.sections[0].en = "gemara english, now highlighted";
    transform(target, renderer);

    expect(target.sections[0].commentary!.Translation.comments[0].en).toBe("steinsaltz english");
  });

  test("hadran segments, which have no Steinsaltz, get a synthetic translation", () => {
    const target = transform(
      page({sections: [segment({ref: "Hadran 1", he: "הדרן", en: "hadran english"})]}),
      bothModeRenderer());

    const translation = target.sections[0].commentary!.Translation.comments[0];
    expect(translation.en).toBe("hadran english");
    expect(translation.ref).toBe("Hadran 1");
  });

  test("non-Talmud segments always get a synthetic translation", () => {
    localStorage.translationOption = "both";
    const target = transform(
      page({sections: [segment({ref: "Genesis 1:1", he: "בראשית", en: "In the beginning"})]}),
      new TestRenderer({isTalmud: false}));

    expect(target.sections[0].commentary!.Translation.comments[0].en).toBe("In the beginning");
  });

  test("an ordinary Talmud segment without Steinsaltz gets no synthetic translation", () => {
    const target = transform(
      page({sections: [segment({ref: "Berakhot 2a:1"})]}),
      bothModeRenderer());

    expect(target.sections[0].commentary?.Translation).toBeUndefined();
  });

  test("hebrew language mode wins over the stored translation option", () => {
    localStorage.translationOption = "both";
    localStorage.languageOption = "hebrew";

    const target = transform(withSteinsaltz(), new TestRenderer({isTalmud: true}));

    expect(Object.keys(target.sections[0].commentary!)).toEqual(["Steinsaltz"]);
  });

  test("a translationOverride is used when no language override applies", () => {
    const target = transform(
      withSteinsaltz(),
      new TestRenderer({isTalmud: true, translationOverride: "both"}));

    expect(Object.keys(target.sections[0].commentary!)).toEqual(["Translation"]);
    expect(target.sections[0].commentary!.Translation.comments[0].he).toEqual("שטיינזלץ");
  });
});
