const {inRange, filterDocumentRange} = require("./filter_document_range.js");

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
          content: content,
        }
      });
      currentStart += content.length;
    }
    return result;
  }

  test("exact match", () => {
    expect(filterDocumentRange(6, 11, createDocument("before", "match", "after")))
      .toEqual(["match"]);
  });

  test("partial matches", () => {
    const actual =
          filterDocumentRange(
            7, 21,
            createDocument(
              "before", ">start", "middle", "end<", "after"));
    expect(actual).toEqual(["start", "middle", "end"]);
  });

  test("remove first match if it's a newline", () => {
    expect(filterDocumentRange(5, 200, createDocument("first\n", "end")))
      .toEqual(["end"]);
  });

  test("remove trailing newlines", () => {
    expect(filterDocumentRange(0, 200, createDocument("first\n", "second\n")))
      .toEqual(["first", "second"]);
  });
});
