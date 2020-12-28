import {applyHighlight} from "../highlight";
import {HighlightCommentWithText} from "../google_drive/types";

function basicComment(text: string) {
  return {
    highlight: true,
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

function matchedSection(text: string) {
  return `<span class="highlighted">${text}</span>`;
}

test("accesses across tags", () => {
  const highlight = (
    applyHighlight(
      basicComment("italics back"),
      "<b>bold<i>bold and italics </i>back to bold</b><i>just italics</i>",
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

test("escape characters", () => {
  const highlight = (
    applyHighlight(
      basicComment("?hello()"),
      "before ?hello() end",
    ));
  expect(highlight).toEqual([
    'before ',
    matchedSection('?hello()'),
    ' end',
  ].join(""));
});

test("wordCount", () => {
  const highlight = (
    applyHighlight(
      {
        highlight: true,
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
    ));
  expect(highlight).toEqual([
    'highlight ',
    matchedSection('highlight'),
    ' highlight',
  ].join(""));
});

test("full text fallback", () => {
  const highlight = (
    applyHighlight(
      {
        highlight: true,
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
    ));
  expect(highlight).toEqual([
    matchedSection('highlight'),
    ' highlight highlight',
  ].join(""));
});

test("no match", () => {
  const highlight = applyHighlight(basicComment("nothing here"), "no match");
  expect(highlight).toBe(undefined);
});


test("ignored characters", () => {
  const highlight = applyHighlight(basicComment("find me"), `f?'";:[]=ind.me`);
  expect(highlight).toBe(matchedSection(`f?'";:[]=ind.me`));
});

test("vocalization and cantillation matching", () => {
  const highlight = applyHighlight(basicComment("נר"), `נֵ֣ר`);
  expect(highlight).toBe(matchedSection(`נֵ֣ר`));
});

test("trim spaces when special characters are at bounds", () => {
  const highlight = applyHighlight(basicComment("?special?"), "<b>st</b>art ?spe<i> c </i>ial? end");
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

test("multiple rounds", () => {
  const highlight = (
    applyHighlight(
      basicComment("1"),
      applyHighlight(
        basicComment("2"),
        applyHighlight(
          basicComment("3"),
          "1 2 3")!)!));
  expect(highlight).toBe([
    matchedSection("1"),
    " ",
    matchedSection("2"),
    " ",
    matchedSection("3"),
  ].join(""));
});
