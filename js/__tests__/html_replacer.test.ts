import {JSDOM} from "jsdom";
import {options, htmlWrapMatches, Wrapper} from "../html_replacer";

const {document} = new JSDOM().window;
options.document = document;

class Subject {
  pattern?: RegExp;
  wrapper?: Wrapper;

  constructor(readonly sourceText: string) {}

  withMatchesWrapped(pattern: string | RegExp, wrapper: Wrapper): Subject {
    if (typeof pattern === "string") {
      this.pattern = new RegExp(pattern, "g");
    } else {
      this.pattern = pattern;
    }
    this.wrapper = wrapper;
    return this;
  }

  equals(expected: string) {
    test("", () => {
      const actual = htmlWrapMatches(this.sourceText, this.pattern!, this.wrapper!);
      expect(actual).toEqual(expected);
    });
  }
}

function assertThatHtml(sourceText: string): Subject {
  return new Subject(sourceText);
}

const SPAN = {prefix: "<span>", suffix: "</span>"};
const UNDERSCORES = {prefix: "__", suffix: "__"};

assertThatHtml("<x>hello b</x>")
  .withMatchesWrapped("b", SPAN)
  .equals("<x>hello <span>b</span></x>");

assertThatHtml("<outerb>hello <b><i>b</i></b></outerb>")
  .withMatchesWrapped("b", SPAN)
  .equals("<outerb>hello <b><i><span>b</span></i></b></outerb>");

assertThatHtml('hello <b><i>b<img alt src="s" /></i></b>')
  .withMatchesWrapped("b", UNDERSCORES)
  .equals('hello <b><i>__b__<img alt src="s" /></i></b>');

assertThatHtml("open <b><i>after close</i><t></t></b>")
  .withMatchesWrapped("after", {prefix: "", suffix: ""})
  .equals("open <b><i>after close</i><t></t></b>");

describe("If starting at a tag, put the wrapper first", () => {
  // This leverages behavior seemingly in React's html sanitizer. Check both cases against the
  // English translation of the last segment of Shabbat 2a.
  assertThatHtml("<strong>GEMARA:</strong> stuff")
    .withMatchesWrapped("GEM", SPAN)
    .equals("<span><strong>GEM</span>ARA:</strong> stuff");

  assertThatHtml("<strong>GEMARA:</strong> stuff")
    .withMatchesWrapped("GEMARA: stu", SPAN)
    .equals("<span><strong>GEMARA:</strong> stu</span>ff");
});

describe("repeats", () => {
  assertThatHtml("ahello helloa")
    .withMatchesWrapped("hello", SPAN)
    .equals("a<span>hello</span> <span>hello</span>a");
});

assertThatHtml("hello regex")
  .withMatchesWrapped("[lr]", {prefix: "<", suffix: ">"})
  .equals("he<l><l>o <r>egex");

assertThatHtml("no match")
  .withMatchesWrapped("[A-Z]", {prefix: "<", suffix: ">"})
  .equals("no match");
