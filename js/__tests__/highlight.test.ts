import {
  applyHighlight,
  createRegexMatcher,
  createSimpleIterativeMatcher,
  Matcher,
} from "../highlight";
import {HighlightCommentWithText} from "../google_drive/types";

function basicComment(text: string, color = "yellow") {
  return {
    highlight: color,
    commentSourceMetadata: {
      startPercentage: 0,
      endPercentage: 1,
      wordCountStart: NaN,
      wordCountEnd: NaN,
      isEnglish: true,
    },
    text,
  } as HighlightCommentWithText;
}

function matchedSection(text: string, color = "yellow") {
  return `<span-highlight class="highlighted highlighted-${color}">${text}</span-highlight>`;
}

const TEST_TYPES: [string, (argument: string) => Matcher | undefined][] = [
  ["iterative", createSimpleIterativeMatcher],
  ["regex", createRegexMatcher],
];
for (const [subName, createMatcher] of TEST_TYPES) {
  test(`accesses across tags [${subName}]`, () => {
    const highlight = (
      applyHighlight(
        basicComment("italics back"),
        "<b>bold<i>bold and italics </i>back to bold</b><i>just italics</i>",
        undefined, createMatcher,
      ));
    expect(highlight).toEqual(
      [
        "<b>bold<i>bold and ",
        matchedSection("italics "),
        "</i>",
        matchedSection("back"),
        " to bold</b><i>just italics</i>",
      ].join(""));
  });

  test(`escape characters [${subName}]`, () => {
    const highlight = (
      applyHighlight(
        basicComment("?hello()"),
        "before ?hello() end",
        undefined, createMatcher,
      ));
    expect(highlight).toEqual([
      'before ',
      matchedSection('?hello()'),
      ' end',
    ].join(""));
  });

  test(`wordCount [${subName}]`, () => {
    const highlight = (
      applyHighlight(
        {
          highlight: "yellow",
          text: "highlight",
          commentSourceMetadata: {
            startPercentage: 1,
            endPercentage: 1,
            wordCountStart: 1,
            wordCountEnd: 2,
            isEnglish: true,
          },
        },
        "highlight highlight highlight",
        undefined, createMatcher,
      ));
    expect(highlight).toEqual([
      'highlight ',
      matchedSection('highlight'),
      ' highlight',
    ].join(""));
  });

  test(`full text fallback [${subName}]`, () => {
    const highlight = (
      applyHighlight(
        {
          highlight: "yellow",
          text: "highlight",
          commentSourceMetadata: {
            startPercentage: 1,
            endPercentage: 1,
            wordCountStart: 3,
            wordCountEnd: 2,
            isEnglish: true,
          },
        },
        "highlight highlight highlight",
        undefined, createMatcher,
      ));
    expect(highlight).toEqual([
      matchedSection('highlight'),
      ' highlight highlight',
    ].join(""));
  });

  test(`no match [${subName}]`, () => {
    const highlight = applyHighlight(basicComment("nothing here"), "no match", undefined, createMatcher);
    expect(highlight).toBe(undefined);
  });


  test(`ignored characters [${subName}]`, () => {
    const highlight = applyHighlight(basicComment("find me"), `f?'";:[]=ind.me`, undefined, createMatcher);
    expect(highlight).toBe(matchedSection(`f?'";:[]=ind.me`));
  });

  test(`vocalization and cantillation matching [${subName}]`, () => {
    const highlight = applyHighlight(basicComment("נר"), `נֵ֣ר`, undefined, createMatcher);
    expect(highlight).toBe(matchedSection(`נֵ֣ר`));
  });

  test(`trim spaces when special characters are at bounds [${subName}]`, () => {
    const highlight = applyHighlight(basicComment("?special?"), "<b>st</b>art ?spe<i> c </i>ial? end", undefined, createMatcher);
    expect(highlight).toBe([
      "<b>st</b>art ",
      matchedSection("?spe"),
      "<i>",
      matchedSection(" c "),
      "</i>",
      matchedSection("ial?"),
      " end",
    ].join(""));
  });

  test(`multiple rounds [${subName}]`, () => {
    const highlight = (
      applyHighlight(
        basicComment("1"),
        applyHighlight(
          basicComment("2"),
          applyHighlight(
            basicComment("3"),
            "1 2 3",
            undefined, createMatcher)!,
          undefined, createMatcher)!,
        undefined, createMatcher));
    expect(highlight).toBe([
      matchedSection("1"),
      " ",
      matchedSection("2"),
      " ",
      matchedSection("3"),
    ].join(""));
  });

  test(`colors [${subName}]`, () => {
    const highlight = (
      applyHighlight(
        basicComment("yellow", "yellow"),
        applyHighlight(
          basicComment("blue", "blue"),
          "aaa yellow bbb blue ccc",
          undefined, createMatcher,
        )!,
        undefined, createMatcher));
    expect(highlight).toEqual(
      [
        "aaa ",
        matchedSection("yellow", "yellow"),
        " bbb ",
        matchedSection("blue", "blue"),
        " ccc",
      ].join(""));
  });
}
