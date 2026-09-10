import * as React from "react";
import {CommentariesBlock} from "../CommentariesBlock";
import {CommentaryType} from "../../commentaries";
import {Commentary, CommentaryMap} from "../../apiTypes";
import {TestConfiguration, TestContext} from "./testing/configuration";
import {
  classesOf,
  click,
  mount,
  query,
  queryAll,
  texts,
  unmountAll,
} from "./testing/dom";
import {
  GtagCall,
  clearPageEnvironment,
  installPageEnvironment,
} from "./testing/page_environment";
import {commentaries, resetFixtureCounter} from "./testing/fixtures";

let gtagCalls: GtagCall[];

beforeEach(() => {
  gtagCalls = installPageEnvironment().gtagCalls;
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

const kind = (
  englishName: string, className: string, extra: Partial<CommentaryType> = {},
): CommentaryType => ({
  englishName,
  className,
  hebrewName: `he:${englishName}`,
  ...extra,
});

const RASHI = kind("Rashi", "rashi");
const TOSAFOT = kind("Tosafot", "tosafot");
const MODEL = kind("Model", "model");
const SEGMENT_LABEL = "2a_section_1";

/**
 * Owns the open/closed state that `Segment` normally owns, so that clicking a button in a test
 * actually opens the commentary. Mirrors `Segment.toggleShowing` with `prependNew: false`.
 */
function Harness({
  commentaryMap,
  initiallyOpen,
}: {
  commentaryMap: CommentaryMap;
  initiallyOpen?: string[];
}): React.ReactElement {
  const [ordering, setOrdering] = React.useState<Record<string, string[]>>(
    initiallyOpen ? {[SEGMENT_LABEL]: initiallyOpen} : {});

  const toggleShowing = (segmentLabel: string, className: string) => {
    let added = false;
    setOrdering(previous => {
      const next = {...previous};
      const current = next[segmentLabel] ?? [];
      added = !current.includes(className);
      next[segmentLabel] = added
        ? [...current, className]
        : current.filter(x => x !== className);
      return next;
    });
    return added;
  };

  return (
    <CommentariesBlock
      commentaries={commentaryMap}
      getOrdering={label => ordering[label] ?? []}
      toggleShowing={toggleShowing}
      segmentLabel={SEGMENT_LABEL}
      />
  );
}

function render(
  commentaryMap: CommentaryMap,
  {commentaryTypes = [RASHI, TOSAFOT], initiallyOpen, ...overrides}: Partial<TestConfiguration> & {
    initiallyOpen?: string[];
  } = {},
): HTMLElement {
  return mount(
    <TestContext overrides={{commentaryTypes, ...overrides}}>
      <Harness commentaryMap={commentaryMap} initiallyOpen={initiallyOpen} />
    </TestContext>,
  );
}

const buttonLabels = (root: HTMLElement) => texts(root, ".show-buttons a.commentary_header");
const button = (root: HTMLElement, className: string) => query(root, `a.${className}`);
const commentTexts = (root: HTMLElement) => texts(root, ".IndividualComment .table-cell.hebrew");

describe("buttons", () => {
  test("shows one button per available commentary, in configured order", () => {
    const root = render(commentaries({Tosafot: [{}], Rashi: [{}]}));

    expect(buttonLabels(root)).toEqual(["he:Rashi", "he:Tosafot"]);
  });

  test("commentaries absent from the data get no button", () => {
    const root = render(commentaries({Rashi: [{}]}));

    expect(buttonLabels(root)).toEqual(["he:Rashi"]);
  });

  test("renders nothing at all when there are no commentaries", () => {
    const root = render({});

    expect(root.innerHTML).toBe("");
  });

  test("a commentary whose comments are all non-unique is dropped", () => {
    const root = render(commentaries({
      Rashi: [{isUnique: false}, {isUnique: false}],
      Tosafot: [{}],
    }));

    expect(buttonLabels(root)).toEqual(["he:Tosafot"]);
  });

  test("non-unique comments still render once the commentary is opened", () => {
    // Pinning current behavior, which is asymmetric: `isUnique: false` is honored when deciding
    // whether a *button* appears (`forEachCommentary`), but the open commentary is read straight
    // out of the map by `getOpenCommentariesInOrder`, which does no filtering. So a commentary
    // whose comments are all non-unique has no button, while a commentary with a mix shows all
    // of them once opened.
    const root = render(
      commentaries({Rashi: [{he: "מיוחד"}, {he: "כפול", isUnique: false}]}),
      {initiallyOpen: ["rashi"]});

    expect(commentTexts(root)).toEqual(["מיוחד", "כפול"]);
  });
});

describe("opening and closing", () => {
  test("clicking a button reveals the comments", () => {
    const root = render(commentaries({Rashi: [{he: "פירוש רשי"}]}));
    expect(commentTexts(root)).toEqual([]);

    click(button(root, "rashi"));

    expect(commentTexts(root)).toEqual(["פירוש רשי"]);
  });

  test("clicking again hides them", () => {
    const root = render(commentaries({Rashi: [{he: "פירוש רשי"}]}));
    click(button(root, "rashi"));

    click(button(root, "rashi"));

    expect(commentTexts(root)).toEqual([]);
  });

  test("an open commentary moves out of the show-buttons row", () => {
    const root = render(commentaries({Rashi: [{}], Tosafot: [{}]}));

    click(button(root, "rashi"));

    expect(buttonLabels(root)).toEqual(["he:Tosafot"]);
    expect(texts(root, "a.rashi")).toEqual(["he:Rashi"]); // the close button
  });

  test("open commentaries render in the order they were opened", () => {
    const root = render(commentaries({
      Rashi: [{he: "רשי"}], Tosafot: [{he: "תוספות"}],
    }));

    click(button(root, "tosafot"));
    click(button(root, "rashi"));

    expect(commentTexts(root)).toEqual(["תוספות", "רשי"]);
  });

  test("opening reports an analytics event, closing reports another", () => {
    const root = render(commentaries({Rashi: [{}]}));

    click(button(root, "rashi"));
    expect(gtagCalls.map(x => x.event)).toEqual(["commentary_viewed"]);

    click(button(root, "rashi"));

    expect(gtagCalls.map(x => x.event)).toEqual(["commentary_viewed", "commentary_hidden"]);
    expect(gtagCalls[0].parameters).toEqual({commentary: "Rashi", section: SEGMENT_LABEL});
    expect(gtagCalls[1].parameters).toEqual({commentary: "Rashi", section: SEGMENT_LABEL});
  });

  test("comments sharing a ref are shown once", () => {
    const root = render(
      commentaries({Rashi: [{ref: "same", he: "ראשון"}, {ref: "same", he: "שני"}]}),
      {initiallyOpen: ["rashi"]});

    expect(commentTexts(root)).toEqual(["ראשון"]);
  });
});

describe("settings that hide buttons", () => {
  const TRANSLATION = kind("Translation", "translation");

  test("the translation button is hidden unless explicitly enabled", () => {
    const root = render(
      commentaries({Translation: [{}], Rashi: [{}]}),
      {commentaryTypes: [TRANSLATION, RASHI]});

    expect(buttonLabels(root)).toEqual(["he:Rashi"]);
  });

  test("the translation button appears when enabled", () => {
    localStorage.showTranslationButton = "yes";
    const root = render(
      commentaries({Translation: [{}], Rashi: [{}]}),
      {commentaryTypes: [TRANSLATION, RASHI]});

    expect(buttonLabels(root)).toEqual(["he:Translation", "he:Rashi"]);
  });

  test("alternate versions are hidden unless enabled", () => {
    const VERSIONS = kind("Versions", "versions");
    const root = render(
      commentaries({Versions: [{}], Rashi: [{}]}),
      {commentaryTypes: [VERSIONS, RASHI]});

    expect(buttonLabels(root)).toEqual(["he:Rashi"]);

    localStorage.showAlternateVersions = "true";
    const withVersions = render(
      commentaries({Versions: [{}], Rashi: [{}]}),
      {commentaryTypes: [VERSIONS, RASHI]});

    expect(buttonLabels(withVersions)).toEqual(["he:Versions", "he:Rashi"]);
  });

  test("alternate versions are hidden when none of them are unique", () => {
    localStorage.showAlternateVersions = "true";
    const VERSIONS = kind("Versions", "versions");
    const root = render(
      commentaries({
        Versions: [{isUnique: false}, {isUnique: false}],
        Rashi: [{}],
      }),
      {commentaryTypes: [VERSIONS, RASHI]});

    expect(buttonLabels(root)).toEqual(["he:Rashi"]);
  });

  test("alternate versions appear when at least one of them is unique", () => {
    localStorage.showAlternateVersions = "true";
    const VERSIONS = kind("Versions", "versions");
    const root = render(
      commentaries({
        Versions: [{isUnique: false}, {}],
        Rashi: [{}],
      }),
      {commentaryTypes: [VERSIONS, RASHI]});

    expect(buttonLabels(root)).toEqual(["he:Versions", "he:Rashi"]);
  });

  test("english-only commentaries are hidden in hebrew mode", () => {
    localStorage.languageOption = "hebrew";
    const ENGLISH_ONLY = kind("Community Translation", "community-translation", {
      ignoreInHebrew: true,
    });
    const root = render(
      commentaries({"Community Translation": [{}], Rashi: [{}]}),
      {commentaryTypes: [ENGLISH_ONLY, RASHI]});

    expect(buttonLabels(root)).toEqual(["he:Rashi"]);
  });
});

describe("the show-more button", () => {
  const manyKinds = (count: number) => (
    [...Array.from({length: count}).keys()].map(i => kind(`Commentary${i}`, `c${i}`)));

  const manyCommentaries = (count: number): CommentaryMap => {
    const result: CommentaryMap = {};
    for (let i = 0; i < count; i++) {
      result[`Commentary${i}`] = {comments: [{
        ref: `ref-${i}`, he: `עברית ${i}`, en: `english ${i}`, sourceRef: "s", sourceHeRef: "s",
      }]};
    }
    return result;
  };

  test("a small number of commentaries shows them all with no more button", () => {
    const root = render(manyCommentaries(8), {commentaryTypes: manyKinds(8)});

    expect(buttonLabels(root)).toHaveLength(8);
    expect(queryAll(root, "a.show-more")).toHaveLength(0);
  });

  test("a large number is truncated behind a more button", () => {
    const root = render(manyCommentaries(12), {commentaryTypes: manyKinds(12)});

    expect(buttonLabels(root).length).toBeLessThan(12);
    expect(queryAll(root, "a.show-more")).toHaveLength(1);
  });

  test("clicking more reveals the rest and offers to hide again", () => {
    const root = render(manyCommentaries(12), {commentaryTypes: manyKinds(12)});

    click(query(root, "a.show-more"));

    expect(buttonLabels(root).filter(x => x !== "עוד" && x !== "פחות")).toHaveLength(12);
    expect(query(root, "a.show-more").textContent).toBe("פחות");
  });

  test("personal notes are never hidden behind the more button", () => {
    const personalNotes = kind("Personal Notes", "personal-notes");
    const root = render(
      {...manyCommentaries(12),
        "Personal Notes": {comments: [{
          ref: "note", he: "הערה", en: "note", sourceRef: "s", sourceHeRef: "s",
        }]}},
      {commentaryTypes: [...manyKinds(12), personalNotes]});

    expect(buttonLabels(root)).toContain("he:Personal Notes");
  });

  test("commentaries containing highlights are never hidden behind the more button", () => {
    const highlighted: Commentary = {comments: [{
      ref: "highlighted",
      he: "מודגש",
      en: "highlighted",
      sourceRef: "s",
      sourceHeRef: "s",
      highlightColors: new Set(["yellow"]) as any,
    }]};
    const root = render(
      {...manyCommentaries(12), Highlighted: highlighted},
      {commentaryTypes: [...manyKinds(12), kind("Highlighted", "highlighted")]});

    expect(buttonLabels(root)).toContain("he:Highlighted");
  });
});

describe("indicators on closed commentaries", () => {
  test("a highlight color is previewed on the button", () => {
    const root = render({
      Rashi: {comments: [{
        ref: "r",
        he: "עברית",
        en: "english",
        sourceRef: "s",
        sourceHeRef: "s",
        highlightColors: new Set(["yellow"]) as any,
      }]},
    });

    const indicators = queryAll(root, ".show-buttons svg path");
    expect(indicators).toHaveLength(1);
    expect(indicators[0].getAttribute("fill")).toBe("var(--highlight-yellow)");
  });

  test("highlight previews disappear once the commentary is open", () => {
    const root = render({
      Rashi: {comments: [{
        ref: "r",
        he: "עברית",
        en: "english",
        sourceRef: "s",
        sourceHeRef: "s",
        highlightColors: new Set(["yellow"]) as any,
      }]},
    }, {initiallyOpen: ["rashi"]});

    expect(queryAll(root, "svg path")).toHaveLength(0);
  });

  test("a comment containing an image is flagged on the button", () => {
    const root = render(commentaries({Rashi: [{he: "<img src='x.png'> עברית"}]}));

    expect(query(root, ".show-buttons").textContent).toContain("📸");
  });

  test("an english-only image is not flagged in hebrew mode", () => {
    localStorage.languageOption = "hebrew";
    const root = render(commentaries({Rashi: [{he: "עברית", en: "<img src='x.png'>"}]}));

    expect(query(root, ".show-buttons").textContent).not.toContain("📸");
  });

  test("a nested personal note is flagged on the parent button", () => {
    const root = render(commentaries({
      Rashi: [{he: "עברית", commentary: commentaries({"Personal Notes": [{he: "הערה"}]})}],
    }));

    expect(classesOf(button(root, "rashi"))).toContain("has-nested-commentaries");
  });

  test("a personal note nested two levels deep is still flagged", () => {
    const root = render(commentaries({
      Rashi: [{
        he: "עברית",
        commentary: commentaries({
          Tosafot: [{
            he: "תוספות",
            commentary: commentaries({"Personal Notes": [{he: "הערה"}]}),
          }],
        }),
      }],
    }));

    expect(classesOf(button(root, "rashi"))).toContain("has-nested-commentaries");
  });

  test("a highlight on a nested comment is previewed on the parent button", () => {
    const root = render({
      Rashi: {comments: [{
        ref: "r",
        he: "עברית",
        en: "english",
        sourceRef: "s",
        sourceHeRef: "s",
        commentary: {
          Tosafot: {comments: [{
            ref: "t",
            he: "תוספות",
            en: "tosafot",
            sourceRef: "s",
            sourceHeRef: "s",
            highlightColors: new Set(["green"]) as any,
          }]},
        },
      }]},
    });

    const indicators = queryAll(root, ".show-buttons svg path");
    expect(indicators.map(x => x.getAttribute("fill"))).toEqual(["var(--highlight-green)"]);
  });

  test("highlights on a comment and on its nested comment are both previewed", () => {
    const root = render({
      Rashi: {comments: [{
        ref: "r",
        he: "עברית",
        en: "english",
        sourceRef: "s",
        sourceHeRef: "s",
        highlightColors: new Set(["yellow"]) as any,
        commentary: {
          Tosafot: {comments: [{
            ref: "t",
            he: "תוספות",
            en: "tosafot",
            sourceRef: "s",
            sourceHeRef: "s",
            highlightColors: new Set(["green"]) as any,
          }]},
        },
      }]},
    });

    const indicators = queryAll(root, ".show-buttons svg path");
    expect(indicators.map(x => x.getAttribute("fill")).sort())
      .toEqual(["var(--highlight-green)", "var(--highlight-yellow)"]);
  });

  test("the same color used at both levels is only previewed once", () => {
    const root = render({
      Rashi: {comments: [{
        ref: "r",
        he: "עברית",
        en: "english",
        sourceRef: "s",
        sourceHeRef: "s",
        highlightColors: new Set(["yellow"]) as any,
        commentary: {
          Tosafot: {comments: [{
            ref: "t",
            he: "תוספות",
            en: "tosafot",
            sourceRef: "s",
            sourceHeRef: "s",
            highlightColors: new Set(["yellow"]) as any,
          }]},
        },
      }]},
    });

    expect(queryAll(root, ".show-buttons svg path")).toHaveLength(1);
  });

  test("an image inside a nested comment is flagged on the parent button", () => {
    const root = render(commentaries({
      Rashi: [{
        he: "עברית",
        commentary: commentaries({Tosafot: [{he: "<img src='x.png'> תוספות"}]}),
      }],
    }));

    expect(query(root, ".show-buttons").textContent).toContain("📸");
  });
});

describe("nested commentaries", () => {
  test("a comment's own commentary renders as a nested block", () => {
    const root = render(
      commentaries({
        Rashi: [{he: "רשי", commentary: commentaries({Tosafot: [{he: "תוספות"}]})}],
      }),
      {initiallyOpen: ["rashi"]});

    expect(commentTexts(root)).toEqual(["רשי"]);
    expect(texts(root, ".show-buttons a.tosafot")).toEqual(["he:Tosafot"]);
  });

  test("nested buttons are prefixed with a depth indicator", () => {
    const root = render(
      commentaries({
        Rashi: [{he: "רשי", commentary: commentaries({Tosafot: [{he: "תוספות"}]})}],
      }),
      {initiallyOpen: ["rashi"]});

    expect(queryAll(root, ".depthIndicator")).toHaveLength(1);
    expect(query(root, ".depthIndicator").textContent).toBe(">");
  });

  test("a comment's Model commentary renders as a nested subcomment button", () => {
    const root = render(
      commentaries({
        Rashi: [{
          he: "רשי",
          commentary: commentaries({
            Model: [{he: "claude-sonnet-5", en: "claude-sonnet-5"}],
          }),
        }],
      }),
      {
        commentaryTypes: [RASHI, MODEL],
        initiallyOpen: ["rashi"],
      });

    expect(texts(root, ".show-buttons a.model")).toEqual(["he:Model"]);
  });
});
