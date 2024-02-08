import {JSDOM} from "jsdom";
import {ListMultimap} from "../multimap";

const document = new JSDOM().window.document;

function log(...x: string) {
  process.stdout.write(x.join(" ") + "\n");
}

// do not submit: rename this from Tag to ElementProxy?
class Tag {
  constructor(
    readonly tag: string,
    readonly startLocation: number,
    readonly length: number,
    readonly attributes: NamedNodeMap,
    readonly overallTagIndex: number, // do not submit: check if this is necessary
  ) {}

  // do not submit: consider using the html_visitor.ts logic to simplify things
  startTagAsText(): string {
    const parts = ["<", this.tag];
    for (const attribute of this.attributes) {
      parts.push(" ", attribute.name);
      if (attribute.value.length > 0) {
        const escaped = attribute.value.replaceAll('"', '\\"');
        parts.push(`="${escaped}"`);
      }
    }
    if (this.hasNoEndTag()) {
      parts.push(" /");
    }
    parts.push(">");
    return parts.join("");
  }

  hasNoEndTag() {
    return this.tag === "img" || this.tag === "br";
  }

  endTagAsText(): string {
    if (this.hasNoEndTag()) {
      return "";
    }
    return `</${this.tag}>`;
  }
}

function extract(sourceText: string): [string, Tag[]] {
  const el = document.createElement('z');
  el.innerHTML = sourceText;
  const expectedPlaintext = el.textContent;

  let currentText = "";
  const tags = [];
  function dfs(node: Node) {
    if (node.nodeName === "#text") {
      currentText += node.textContent;
    } else {
      tags.push(
        new Tag(
          node.localName, currentText.length, node.textContent.length, node.attributes, tags.length,
        ));
    }

    for (const child of Array.from(node.childNodes)) {
      dfs(child);
    }
    // throw new Error(node);
  }

  for (const node of Array.from(el.childNodes)) {
    dfs(node);
  }

  if (currentText !== expectedPlaintext) {
    throw new Error([
      `Plaintext of ${sourceText} was not extracted correctly. Actual: ${currentText}. Expected: `,
      `${expectedPlaintext}`,
    ].join(""));
  }

  return [expectedPlaintext, tags];
}

function replacer(sourceText: string, pattern: string, replacement: string): string {
  // do not submit: assert pattern and replacement are sanitized!
  const [plaintext, tags] = extract(sourceText);
  let tagsIndex = 0;
  let currentLength = 0;
  const endTags = new ListMultimap<number, string>();
  const chunks = [];
  const splits = plaintext.split(pattern);

  const processTags = () => {
    for (; tagsIndex < tags.length; tagsIndex++) {
      const tag = tags[tagsIndex];
      if (tag.startLocation === currentLength) {
        if (tag.length == 0) {
          chunks.push(tag.startTagAsText(), tag.endTagAsText());
        } else {
          chunks.push(tag.startTagAsText());
          endTags.get(currentLength + tag.length).unshift(tag.endTagAsText());
        }
      } else {
        break;
      }
    }
  };

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i];
    for (let ij = 0; ij < split.length; ij++) {
      chunks.push(...endTags.get(currentLength));
      processTags();

      chunks.push(split.charAt(ij));
      currentLength++;
      processTags();
    }

    if (i === splits.length - 2) {
      currentLength += pattern.length;
      chunks.push(replacement);
    }
  }

  processTags();
  const extraTags = tags.slice(tagsIndex);
  if (extraTags.length > 0) {
    console.error(extraTags);
    throw new Error("Extra tags!");
  }


  chunks.push(...endTags.get(currentLength));
  return chunks.join("");
}

let testCounter = 0;

class Subject {
  pattern?: string;
  replacement?: string;

  constructor(readonly sourceText: string) {}

  withReplacement(pattern: string, replacement: string): Subject {
    this.pattern = pattern;
    this.replacement = replacement;
    return this;
  }

  equals(expected: string) {
    const actual = replacer(this.sourceText, this.pattern!, this.replacement!);
    testCounter += 1;
    test("" + testCounter, () => {
      expect(actual).toEqual(expected);
    })
  }
}

function assertThat(sourceText: string): Subject {
  return new Subject(sourceText);
}

/*
assertThat("hello <b>wor</b>ld!")
  .withReplacement("world", "<span>world</span>")
  .equals("hello <span><b>wor</b>ld</span>!");

assertThat("hello <b>b</b>")
  .withReplacement("b", "<span>b</span>")
  .equals("hello <b><span>b</span></b>");
*/
// do not submit: test with attributes

assertThat("<outerb>hello <b><i>b</i></b></outerb>")
  .withReplacement("b", "<span>b</span>")
  .equals("<outerb>hello <b><i><span>b</span></i></b></outerb>");

assertThat('hello <b><i>b<img alt src="s" /></i></b>')
  .withReplacement("b", "__b__")
  .equals('hello <b><i>__b__<img alt src="s" /></i></b>');

assertThat("open <b><i>after close</i><t></t></b>")
  .withReplacement("after", "after")
  .equals("open <b><i>after close</i><t></t></b>");
