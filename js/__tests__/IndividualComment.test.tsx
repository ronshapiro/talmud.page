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
  texts,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";
import {comment, resetFixtureCounter} from "./testing/fixtures";
import {ApiComment} from "../../apiTypes";

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
