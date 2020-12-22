import {
  inRange,
  joinAdjacentElements,
  extractDocumentText,
  DocumentText,
  ParagraphElement,
  // @ts-ignore
} from "../document_text.ts";

describe("inRange()", () => {
  test("before", () => {
    expect(inRange({startIndex: 10, endIndex: 20})({startIndex: 5, endIndex: 9})).toBe(false);
  });

  test("end == start", () => {
    expect(inRange({startIndex: 10, end: 20})({startIndex: 5, endIndex: 10})).toBe(false);
  });

  test("before and during", () => {
    expect(inRange({startIndex: 10, endIndex: 20})({startIndex: 5, endIndex: 11})).toBe(true);
  });

  test("start and before end", () => {
    expect(inRange({startIndex: 10, end: 20})({startIndex: 10, endIndex: 11})).toBe(true);
  });

  test("start and end", () => {
    expect(inRange({startIndex: 10, end: 20})({startIndex: 10, endIndex: 20})).toBe(true);
  });

  test("start and after end", () => {
    expect(inRange({startIndex: 10, end: 20})({startIndex: 10, endIndex: 21})).toBe(true);
  });

  test("start == end", () => {
    expect(inRange({startIndex: 10, end: 20})({startIndex: 20, endIndex: 21})).toBe(false);
  });

  test("after start and end", () => {
    expect(inRange({startIndex: 10, end: 20})({startIndex: 21, endIndex: 22})).toBe(false);
  });
});

describe("extractDocumentText()", () => {
  const createDocument = (...contents: string[]): ParagraphElement[] => {
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

  const extractJustText = (
    (start: number, end: number, inputs: ParagraphElement[]): string[] => {
      return extractDocumentText({startIndex: start, endIndex: end}, inputs)
        .map((x: DocumentText) => x.text);
    }
  );

  test("exact match", () => {
    expect(extractJustText(6, 11, createDocument("before", "match", "after")))
      .toEqual(["match"]);
  });

  test("partial matches", () => {
    const actual = (
      extractJustText(
        7, 23,
        createDocument(
          "before", ">start", " middle ", "end<", "after")));
    expect(actual).toEqual(["start middle end"]);
  });

  test("trim newlines", () => {
    expect(extractJustText(0, 200, createDocument("\nfirst\n", "second\n")))
      .toEqual(["first<br>second"]);
  });

  test("escaping", () => {
    const document = (
      createDocument(
        "hello<script>console.log('hack & \" me');</script>",
        "<scr", "ipt>", "broken", "<", "/", "script>",
      )
    );
    const expected = [
      "hello&lt;script&gt;console.log(&#039;hack &amp; &quot; me&#039;);&lt;/script",
      "&gt;&lt;script&gt;broken&lt;/script&gt;",
    ].join("");
    expect(extractJustText(0, 200, document)).toEqual([expected]);
  });

  test("styling", () => {
    const document = createDocument("bold me");
    document[0].textRun.textStyle = {bold: true};
    expect(extractJustText(0, 200, document)).toEqual([
      '<span class="personal-comment-bold">bold me</span>']);
  });

  test("combo styles", () => {
    const document = createDocument("combo");
    document[0].textRun.textStyle = {
      bold: true,
      italic: true,
      strikethrough: true,
      underline: true,
      link: {
        url: "the-url",
      },
    };
    expect(extractJustText(0, 200, document)).toEqual([
      '<a href="the-url"><span class="personal-comment-bold personal-comment-italic '
        + 'personal-comment-underline personal-comment-strikethrough">combo</span></a>']);
  });

  test("plaintext version", () => {
    const document = createDocument("before", ">start", " <middle> ", "\nend\n<", "after");
    document.forEach(x => {
      x.textRun.textStyle = {
        bold: true,
        italic: true,
        strikethrough: true,
        underline: true,
        link: {
          url: "the-url",
        },
      };
    });
    expect(
      extractDocumentText({startIndex: 7, endIndex: 27}, document, true)
        .map((x: DocumentText) => x.text))
      .toEqual(["start <middle> \nend"]);
  });

  test("non URL link is ignored", () => {
    const document = createDocument("unmodified");
    document[0].textRun.textStyle = {link: {notUrl: "notUrl"}};

    expect(extractJustText(0, 200, document)).toEqual(["unmodified"]);
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
      languageStats: {
        hebrew: 1,
        english: 2,
      },
    }, {
      startIndex: 2,
      endIndex: 3,
      textRun: {
        content: "B",
      },
      languageStats: {
        hebrew: 3,
        english: 4,
      },
    }];

    joinAdjacentElements(input);

    expect(input).toEqual([{
      startIndex: 1,
      endIndex: 2,
      textRun: {
        content: "A",
      },
      languageStats: {
        hebrew: 1,
        english: 2,
      },
    }, {
      startIndex: 2,
      endIndex: 3,
      textRun: {
        content: "B",
      },
      languageStats: {
        hebrew: 3,
        english: 4,
      },
    }]);
  });
});
