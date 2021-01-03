import {books, QueryResult} from "../books";

class Subject {
  constructor(private query: string) {}

  isExtractedTo(title: string, start: string, end?: string) {
    const queryResult = books.parse(this.query);
    const errors: string[] = [];
    if (queryResult.bookName !== title) {
      errors.push(`expected title to be ${title}, but was ${queryResult.bookName}`);
    }
    if (queryResult.start !== start) {
      errors.push(`expected start to be ${start}, but was {queryResult.start}`);
    }
    if (queryResult.end !== end) {
      errors.push(`expected end to be ${end}, but was {queryResult.end}`);
    }

    expect(errors).toEqual([]);
  }

  doesntParse() {
    let result: QueryResult;
    try {
      result = books.parse(this.query);
    } catch (e) {
      return;
    }
    throw new Error(`${this.query} successfully parsed as ${result}, but was expected to fail.`);
  }
}

function assertThat(query: string): Subject {
  return new Subject(query);
}

test("Regular amud", () => {
  assertThat("Brachot 20a").isExtractedTo("Berakhot", "20a");
  assertThat("Brachot 20b").isExtractedTo("Berakhot", "20b");
});

test("Amud ending with colon or period", () => {
  assertThat("Brachot 20.").isExtractedTo("Berakhot", "20a");
  assertThat("Brachot 20:").isExtractedTo("Berakhot", "20b");
});

test("Full amud", () => {
  assertThat("Brachot 20").isExtractedTo("Berakhot", "20a", "20b");
});

test("Hebrew format", () => {
  assertThat("Shabbat ק.").isExtractedTo("Shabbat", "100a");
  assertThat("Shabbat קכ.").isExtractedTo("Shabbat", "120a");
  assertThat("Shabbat קכג.").isExtractedTo("Shabbat", "123a");
  assertThat("Shabbat קג.").isExtractedTo("Shabbat", "103a");
});

test("Range with full daf on one side", () => {
  assertThat("Brachot 2-3a").isExtractedTo("Berakhot", "2a", "3a");
  assertThat("Brachot 2 - 3a").isExtractedTo("Berakhot", "2a", "3a");
  assertThat("Brachot 2 to 3a").isExtractedTo("Berakhot", "2a", "3a");
  assertThat("Brachot 2 to 3").isExtractedTo("Berakhot", "2a", "3b");
  assertThat("Brachot 2b to 3").isExtractedTo("Berakhot", "2b", "3b");
});

test("Daf ab", () => {
  assertThat("Brachot 2ab").isExtractedTo("Berakhot", "2a", "2b");
});

test("Hebrew ranges", () => {
  assertThat("ברכות ב").isExtractedTo("Berakhot", "2a", "2b");
  assertThat("ברכות ב.").isExtractedTo("Berakhot", "2a");
  assertThat("ברכות ב:").isExtractedTo("Berakhot", "2b");
});

test("Lots of spaces", () => {
  assertThat("     Brachot     2a     to     2b   ").isExtractedTo("Berakhot", "2a", "2b");
});

test("Masechet with space", () => {
  assertThat("Rosh Hashana 2a").isExtractedTo("Rosh Hashanah", "2a");
});

test("Invalid hebrew numeric", () => {
  assertThat("Brachot ככ").doesntParse();
});

test("Invalid Masechet", () => {
  assertThat("Not Shabbat 2a").doesntParse();
  assertThat("Not Shabbat 2a").doesntParse();
});

test("Invalid amudim", () => {
  assertThat("Shabbat 2c").doesntParse();
  assertThat("Shabbat 2c-3a").doesntParse();
  assertThat("Shabbat 2b-3c").doesntParse();
  assertThat("Shabbat 2b-2c").doesntParse();
  assertThat("Shabbat 2c-3a").doesntParse();
});

test("Invalid chapters", () => {
  assertThat("Genesis -1").doesntParse();
  assertThat("Genesis A").doesntParse();
  assertThat("Genesis 1suffix").doesntParse();
  assertThat("Shabbat A-2").doesntParse();
  assertThat("Shabbat 2-4suffix").doesntParse();
});
