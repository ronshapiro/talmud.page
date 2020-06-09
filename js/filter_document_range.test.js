const {inRange, joinAdjacentElements, filterDocumentRange} = require("./filter_document_range.js");

describe("inRange()", () => {
  test("before", () => {
    expect(inRange(10, 20)({startIndex: 5, endIndex: 9})).toBe(false);
  });

  test("end == start", () => {
    expect(inRange(10, 20)({startIndex: 5, endIndex: 10})).toBe(false);
  });

  test("before and during", () => {
    expect(inRange(10, 20)({startIndex: 5, endIndex: 11})).toBe(true);
  });

  test("start and before end", () => {
    expect(inRange(10, 20)({startIndex: 10, endIndex: 11})).toBe(true);
  });

  test("start and end", () => {
    expect(inRange(10, 20)({startIndex: 10, endIndex: 20})).toBe(true);
  });

  test("start and after end", () => {
    expect(inRange(10, 20)({startIndex: 10, endIndex: 21})).toBe(true);
  });

  test("start == end", () => {
    expect(inRange(10, 20)({startIndex: 20, endIndex: 21})).toBe(false);
  });

  test("after start and end", () => {
    expect(inRange(10, 20)({startIndex: 21, endIndex: 22})).toBe(false);
  });
});

describe("filterDocumentRange()", () => {
  const createDocument = (...contents) => {
    const result = [];
    let currentStart = 0;
    for (const content of contents) {
      result.push({
        startIndex: currentStart,
        endIndex: currentStart + content.length,
        textRun: {
          content,
        },
      });
      currentStart += content.length;
    }
    return result;
  };

  test("exact match", () => {
    expect(filterDocumentRange(6, 11, createDocument("before", "match", "after")))
      .toEqual(["match"]);
  });

  test("partial matches", () => {
    const actual = (
      filterDocumentRange(
        7, 23,
        createDocument(
          "before", ">start", " middle ", "end<", "after")));
    expect(actual).toEqual(["start middle end"]);
  });

  test("trim newlines", () => {
    expect(filterDocumentRange(0, 200, createDocument("\nfirst\n", "second\n")))
      .toEqual(["first<br>second"]);
  });
});

describe("joinAdjacentElements", () => {
  test("joining doesn't modify original elements", () => {
    const input = [{
      startIndex: 1,
      endIndex: 2,
      textRun: {
        content: "A",
      },
    }, {
      startIndex: 2,
      endIndex: 3,
      textRun: {
        content: "B",
      },
    }];

    joinAdjacentElements(input);

    expect(input).toEqual([{
      startIndex: 1,
      endIndex: 2,
      textRun: {
        content: "A",
      },
    }, {
      startIndex: 2,
      endIndex: 3,
      textRun: {
        content: "B",
      },
    }]);
  });
});
