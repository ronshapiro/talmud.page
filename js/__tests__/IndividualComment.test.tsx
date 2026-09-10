import * as React from "react";
import {IndividualComment} from "../IndividualComment";
import {CommentaryType} from "../../commentaries";
import {TestContext} from "./testing/configuration";
import {
  attributes,
  classesOf,
  mount,
  query,
  queryAll,
  queryOrNull,
  texts,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";
import {comment, resetFixtureCounter} from "./testing/fixtures";
import {ApiComment} from "../../apiTypes";
import {rsiReviewKeyPreference} from "../settings";

beforeEach(() => {
  installPageEnvironment();
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

const RASHI: CommentaryType = {
  englishName: "Rashi",
  hebrewName: 'רש"י',
  className: "rashi",
};

function renderComment(
  overrides: Partial<ApiComment> = {},
  commentaryKind: CommentaryType = RASHI,
  contextOverrides = {},
): HTMLElement {
  return mount(
    <TestContext overrides={contextOverrides}>
      <IndividualComment comment={comment(overrides)} commentaryKind={commentaryKind} />
    </TestContext>,
  );
}

const hebrews = (root: HTMLElement) => texts(root, ".table-cell.hebrew");
const englishes = (root: HTMLElement) => texts(root, ".table-cell.english");

describe("content shapes", () => {
  test("plain strings render as a single row", () => {
    const root = renderComment({he: "עברית", en: "english"});

    expect(hebrews(root)).toEqual(["עברית"]);
    expect(englishes(root)).toEqual(["english"]);
  });

  test("matched hebrew/english arrays render one row per line", () => {
    const root = renderComment({he: ["אחד", "שתים"], en: ["one", "two"]});

    expect(hebrews(root)).toEqual(["אחד", "שתים"]);
    expect(englishes(root)).toEqual(["one", "two"]);
  });

  test("mismatched array lengths fall back to one row, joined with line breaks", () => {
    const root = renderComment({he: ["אחד", "שתים"], en: ["only one"]});

    expect(queryAll(root, ".table-row")).toHaveLength(1);
    expect(query(root, ".table-cell.hebrew").innerHTML).toBe("אחד<br>שתים");
    expect(query(root, ".table-cell.english").innerHTML).toBe("only one");
  });

  // `sefaria.TextType` is declared flat (`string | string[]`) but the API does return jagged
  // arrays, which is why IndividualComment flattens before comparing lengths. The ts-ignores
  // below match the ones in sefariaTextType.test.ts and the note in sefaria.d.ts.
  test("nested arrays whose flattened lengths differ fall back to a joined row", () => {
    // @ts-ignore
    const root = renderComment({he: [["אחד", "שתים"]], en: [["one"]]});

    expect(queryAll(root, ".table-row")).toHaveLength(1);
  });

  test("nested arrays with matching flattened lengths render per line", () => {
    // @ts-ignore
    const root = renderComment({he: [["אחד"], ["שתים"]], en: [["one"], ["two"]]});

    expect(hebrews(root)).toEqual(["אחד", "שתים"]);
    expect(englishes(root)).toEqual(["one", "two"]);
  });

  test("explicit rows render one row each", () => {
    const root = renderComment({
      rows: [
        {hebrew: "אחד", english: "one"},
        {hebrew: "שתים", english: "two"},
      ],
    });

    expect(hebrews(root)).toEqual(["אחד", "שתים"]);
    expect(englishes(root)).toEqual(["one", "two"]);
  });

  test("image rows get their own full-row entry", () => {
    const root = renderComment(
      {
        ref: "Comment 1",
        rows: [{image: "<img src='diagram.png'>"}, {hebrew: "אחד", english: "one"}],
      },
      {...RASHI, nestedRefSpacer: ":"});

    const imageRow = query(root, ".commentFullRowImage");
    expect(queryAll(imageRow, "img")).toHaveLength(1);
    // The image shares the line number of the text row that follows it.
    expect(imageRow.getAttribute("sefaria-ref")).toBe("Comment 1:1-image");
  });

  test("rows with neither hebrew nor english nor image are skipped", () => {
    const root = renderComment({rows: [{}, {hebrew: "אחד"}]});

    expect(hebrews(root)).toEqual(["אחד"]);
  });
});

/**
 * `rows` is a parallel rendering path to the `he`/`en` branches, used today only by "Steinsaltz
 * In-Depth" comments (see getSteinsaltzCommentRows in steinsaltz.ts, which emits image rows plus
 * one text row). These tests compare it against the default path and pin the places where it
 * behaves differently or supports less.
 */
describe("the rows path compared with the he/en path", () => {
  test("rows take precedence over he and en entirely", () => {
    const root = renderComment({
      he: "עברית שלא תוצג",
      en: "english that is not shown",
      rows: [{hebrew: "מהשורה", english: "from the row"}],
    });

    expect(hebrews(root)).toEqual(["מהשורה"]);
    expect(englishes(root)).toEqual(["from the row"]);
  });

  test("an empty rows list renders nothing, and does not fall back to he/en", () => {
    // `if (comment.rows)` is true for an empty array, so the he/en branches are never reached.
    // Nothing in the codebase currently emits `rows: []`, but the fallback is worth knowing about.
    const root = renderComment({he: "עברית", en: "english", rows: []});

    expect(hebrews(root)).toEqual([]);
    expect(englishes(root)).toEqual([]);
    expect(queryAll(root, ".IndividualComment")).toHaveLength(0);
  });

  test("both paths carry the commentary class and the comment link", () => {
    const viaRows = renderComment({rows: [{hebrew: "אחד"}], link: "https://example.com"});
    const viaText = renderComment({he: "אחד", en: "", link: "https://example.com"});

    for (const root of [viaRows, viaText]) {
      expect(classesOf(query(root, ".table-row"))).toContain("rashi");
      expect(query(root, ".table-row").getAttribute("tp-link")).toBe("https://example.com");
    }
  });

  test("both paths mark directly referenced lines", () => {
    const viaRows = renderComment({
      rows: [{hebrew: "אחד", ref: "Ref A"}, {hebrew: "שתים", ref: "Ref B"}],
      originalRefsBeforeRewriting: ["Ref B"],
    });
    const viaText = renderComment({
      he: ["אחד", "שתים"],
      en: ["one", "two"],
      expandedRefsAfterRewriting: ["Ref A", "Ref B"],
      originalRefsBeforeRewriting: ["Ref B"],
    });

    for (const root of [viaRows, viaText]) {
      expect(queryAll(root, ".directlyReferencedLine").map(x => x.getAttribute("sefaria-ref")))
        .toEqual(["Ref B"]);
    }
  });

  test("both paths mark text rows as AI-modified", () => {
    const viaRows = renderComment({rows: [{hebrew: "אחד"}], didModifyUiWithAiVersion: true});
    const viaText = renderComment({he: "אחד", en: "", didModifyUiWithAiVersion: true});

    for (const root of [viaRows, viaText]) {
      expect(classesOf(query(root, ".table-row"))).toContain("ai-modified");
    }
  });

  test("marks text rows as pending-review for every reader, review controls only for a key-holder",
    () => {
      const withoutKey = renderComment({he: "אחד", en: "", pendingReview: "Zevachim 2a"});
      expect(classesOf(query(withoutKey, ".table-row"))).toContain("pending-review");
      expect(queryOrNull(withoutKey, ".rsi-review-controls")).toBeNull();

      rsiReviewKeyPreference.set("secret123");
      const withKey = renderComment({he: "אחד", en: "", pendingReview: "Zevachim 2a"});
      expect(query(withKey, ".rsi-review-controls")).toBeTruthy();
    });

  test("image rows do not get the AI-modified marker that their text row gets", () => {
    // The image row is built with `extraClasses={["commentFullRowImage"]}`, discarding the
    // extraClasses the text rows receive. Harmless today, since only Steinsaltz In-Depth emits
    // images and it is not AI-rewritten, but the two rows of one comment disagree.
    const root = renderComment({
      rows: [{image: "<img src='x.png'>"}, {hebrew: "אחד"}],
      didModifyUiWithAiVersion: true,
    });

    expect(classesOf(query(root, ".commentFullRowImage"))).not.toContain("ai-modified");
    expect(classesOf(queryAll(root, ".table-row")[1])).toContain("ai-modified");
  });

  test("a row's own ref wins, where the he/en path can only use generated refs", () => {
    const viaRows = renderComment({
      ref: "Comment 1",
      rows: [{hebrew: "אחד", ref: "Explicit"}],
    });

    expect(attributes(viaRows, ".table-row", "sefaria-ref")).toEqual(["Explicit"]);
  });

  test("rows fall back to the same generated refs as the he/en path", () => {
    const viaRows = renderComment(
      {ref: "Comment 1", rows: [{hebrew: "אחד"}, {hebrew: "שתים"}]},
      {...RASHI, nestedRefSpacer: ":"});
    const viaText = renderComment(
      {ref: "Comment 1", he: ["אחד", "שתים"], en: ["one", "two"]},
      {...RASHI, nestedRefSpacer: ":"});

    expect(attributes(viaRows, ".table-row", "sefaria-ref"))
      .toEqual(["Comment 1:1", "Comment 1:2"]);
    expect(attributes(viaText, ".table-row", "sefaria-ref"))
      .toEqual(["Comment 1:1", "Comment 1:2"]);
  });

  test("both paths report duplicates the same way", () => {
    const viaRows = renderComment({rows: [{hebrew: "אחד"}], duplicateRefs: ["Other 1"]});
    const viaText = renderComment({he: "אחד", en: "", duplicateRefs: ["Other 1"]});

    for (const root of [viaRows, viaText]) {
      expect(query(root, "button").textContent).toContain("Other 1");
    }
  });

  test("both paths suppress english for hebrew-only commentaries", () => {
    const vilnaShas: CommentaryType = {
      englishName: "Vilna Shas", hebrewName: 'ש"ס וילנא', className: "vilna-shas",
    };
    const viaRows = renderComment({rows: [{hebrew: "אחד", english: "one"}]}, vilnaShas);
    const viaText = renderComment({he: "אחד", en: "one"}, vilnaShas);

    expect(englishes(viaRows)).toEqual([]);
    expect(englishes(viaText)).toEqual([]);
  });

  test("a rows comment contributes its english to the title decision", () => {
    const withTitle: CommentaryType = {...RASHI, showTitle: true};
    const root = renderComment(
      {sourceRef: "Steinsaltz",
        sourceHeRef: "שטיינזלץ",
        he: "",
        en: "",
        rows: [{hebrew: "אחד", english: "one"}]},
      withTitle);

    // The english title is included because a row has english, even though comment.en is empty.
    expect(englishes(root)[0]).toBe("Steinsaltz");
  });

  test("a rows comment with no english anywhere drops the english title", () => {
    const withTitle: CommentaryType = {...RASHI, showTitle: true};
    const root = renderComment(
      {sourceRef: "Steinsaltz",
        sourceHeRef: "שטיינזלץ",
        he: "",
        en: "",
        rows: [{hebrew: "אחד"}]},
      withTitle);

    expect(englishes(root)).toEqual([]);
  });
});

describe("titles", () => {
  const withTitle: CommentaryType = {...RASHI, showTitle: true};

  test("a title row is added for commentary kinds that show titles", () => {
    const root = renderComment(
      {sourceRef: "Genesis 1:1", sourceHeRef: "בראשית א׳:א׳"}, withTitle);

    expect(hebrews(root)[0]).toBe("בראשית א׳:א׳");
    expect(englishes(root)[0]).toBe("Genesis 1:1");
    expect(queryAll(root, "strong")).toHaveLength(1);
  });

  test("the english title is dropped when the comment has no english at all", () => {
    const root = renderComment(
      {sourceRef: "Genesis 1:1", sourceHeRef: "בראשית א׳:א׳", he: "עברית", en: ""}, withTitle);

    expect(englishes(root)).toEqual([]);
  });

  test("no title row without showTitle", () => {
    const root = renderComment({sourceRef: "Genesis 1:1"}, RASHI);

    expect(queryAll(root, "strong")).toHaveLength(0);
  });
});

describe("refs", () => {
  test("each line gets the comment's ref by default", () => {
    const root = renderComment({ref: "Rashi on Berakhot 2a:1", he: "עברית", en: "english"});

    expect(attributes(root, ".table-row", "sefaria-ref")).toEqual(["Rashi on Berakhot 2a:1"]);
  });

  test("nestedRefSpacer generates a per-line ref", () => {
    const root = renderComment(
      {ref: "Mishnah Berakhot 1", he: ["אחד", "שתים"], en: ["one", "two"]},
      {...RASHI, nestedRefSpacer: ":"});

    expect(attributes(root, ".table-row", "sefaria-ref"))
      .toEqual(["Mishnah Berakhot 1:1", "Mishnah Berakhot 1:2"]);
  });

  test("lines are marked ignore-drive when they have no addressable ref", () => {
    const root = renderComment({he: ["אחד", "שתים"], en: ["one", "two"]});

    expect(attributes(root, ".table-row", "sefaria-ref"))
      .toEqual(["ignore-drive", "ignore-drive"]);
  });

  test("expandedRefsAfterRewriting supplies per-line refs", () => {
    const root = renderComment({
      he: ["אחד", "שתים"],
      en: ["one", "two"],
      expandedRefsAfterRewriting: ["Ref A", "Ref B"],
    });

    expect(attributes(root, ".table-row", "sefaria-ref")).toEqual(["Ref A", "Ref B"]);
  });

  test("directly referenced lines are marked so they can be styled", () => {
    const root = renderComment({
      he: ["אחד", "שתים"],
      en: ["one", "two"],
      expandedRefsAfterRewriting: ["Ref A", "Ref B"],
      originalRefsBeforeRewriting: ["Ref B"],
    });

    const marked = queryAll(root, ".directlyReferencedLine");
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute("sefaria-ref")).toBe("Ref B");
  });

  test("a row's own ref wins over generated ones", () => {
    const root = renderComment({rows: [{hebrew: "אחד", ref: "Explicit Ref"}]});

    expect(attributes(root, ".table-row", "sefaria-ref")).toEqual(["Explicit Ref"]);
  });
});

describe("classes", () => {
  test("every row carries the commentary class with spaces replaced", () => {
    const root = renderComment({he: "עברית"}, {
      englishName: "Referenced Mishna",
      hebrewName: "משנה",
      className: "mishna reference",
    });

    expect(classesOf(query(root, ".table-row"))).toContain("mishna_reference");
    expect(classesOf(query(root, ".table-row"))).toContain("IndividualComment");
  });

  test("AI-modified comments are marked", () => {
    const root = renderComment({he: "עברית", didModifyUiWithAiVersion: true});

    expect(classesOf(query(root, ".table-row"))).toContain("ai-modified");
  });
});

describe("special commentary kinds", () => {
  test("Vilna Shas never shows english, since it is a hebrew-only version", () => {
    const root = renderComment(
      {he: "עברית", en: "english"},
      {englishName: "Vilna Shas", hebrewName: 'ש"ס וילנא', className: "vilna-shas"});

    expect(englishes(root)).toEqual([]);
  });

  test("Model commentary renders model name without a title header", () => {
    const root = renderComment(
      {he: "claude-sonnet-5", en: "claude-sonnet-5", sourceRef: "Model", sourceHeRef: "מודל"},
      {englishName: "Model", hebrewName: "מודל", className: "model"});

    expect(hebrews(root)).toEqual(["claude-sonnet-5"]);
    expect(englishes(root)).toEqual(["claude-sonnet-5"]);
    expect(queryOrNull(root, "strong")).toBeNull();
  });

  test("a Translation comment expands by default when the setting is on", () => {
    localStorage.expandEnglishByDefault = "true";
    const root = renderComment(
      {he: "עברית", en: "english"},
      {englishName: "Translation", hebrewName: "תרגום", className: "translation"});

    expect(classesOf(query(root, ".table-cell.english"))).not.toContain("lineClamped");
  });
});

describe("duplicate reporting", () => {
  test("a report button appears when duplicates are known", () => {
    const root = renderComment({he: "עברית", duplicateRefs: ["Rashi on Berakhot 2b:1"]});

    expect(query(root, "button").textContent).toBe("לדווח כפילויות: Rashi on Berakhot 2b:1");
  });

  test("no button when there are no duplicates", () => {
    const root = renderComment({he: "עברית", duplicateRefs: []});

    expect(queryAll(root, "button")).toHaveLength(0);
  });
});
