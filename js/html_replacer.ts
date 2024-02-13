export const options: any = {};

// Set options.document in tests to set to a JSDOM document
function getDocument(): Document {
  return options.document || document;
}

abstract class AbstractTag {
  constructor(readonly tag: string) {}

  hasNoEndTag() {
    return this.tag === "img" || this.tag === "br";
  }
}

class StartTag extends AbstractTag {
  constructor(
    tag: string,
    readonly startLocation: number,
    readonly length: number,
    readonly attributes: NamedNodeMap,
  ) {
    super(tag);
  }

  // do not submit: consider using the html_visitor.ts logic to simplify things
  asText(): string {
    const parts = ["<", this.tag];
    for (const attribute of Array.from(this.attributes)) {
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
}

class EndTag extends AbstractTag {
  length = 0;

  constructor(tag: string, readonly startLocation: number) {
    super(tag);
  }

  asText(): string {
    if (this.hasNoEndTag()) {
      return "";
    }
    return `</${this.tag}>`;
  }
}

type Tag = StartTag | EndTag;

function extract(sourceText: string): [string, Tag[]] {
  let currentText = "";
  const tags: Tag[] = [];
  function dfs(node: Node) {
    if (node.nodeName === "#text") {
      currentText += node.textContent;
    } else {
      const asElement: HTMLElement = node as HTMLElement;
      const length = asElement.textContent?.length ?? 0
      tags.push(
        new StartTag(asElement.localName, currentText.length, length, asElement.attributes));
    }

    for (const child of Array.from(node.childNodes)) {
      dfs(child);
    }

    if (node.nodeName !== "#text") {
      const asElement: HTMLElement = node as HTMLElement;
      tags.push(new EndTag(asElement.localName, currentText.length));
    }
  }

  const fakeRoot = getDocument().createElement('z');
  fakeRoot.innerHTML = sourceText;
  const expectedPlaintext = fakeRoot.textContent;

  for (const element of Array.from(fakeRoot.childNodes)) {
    dfs(element);
  }

  if (currentText !== expectedPlaintext) {
    throw new Error([
      `Plaintext of '${sourceText}' was not extracted correctly. Actual: ${currentText}. Expected: `,
      `${expectedPlaintext}`,
    ].join(""));
  }

  return [expectedPlaintext, tags];
}

export interface Wrapper {
  prefix: string;
  suffix: string;
}

export function htmlWrapMatches(
  sourceText: string, pattern: RegExp, wrapper: Wrapper,
): string {
  // do not submit: assert pattern is sanitized!
  const [plaintext, tags] = extract(sourceText);
  let currentLength = 0;
  let tagsIndex = 0;
  const chunks = [];

  const processTags = () => {
    for (; tagsIndex < tags.length; tagsIndex++) {
      const tag = tags[tagsIndex];
      if (tag.startLocation === currentLength) {
        chunks.push(tag.asText());
      } else {
        break;
      }
    }
  };

  const matches = Array.from(plaintext.matchAll(pattern));
  if (matches.length === 0) return sourceText;

  let lastIndex = 0;
  for (const match of matches) {
    const split = plaintext.slice(lastIndex, match.index!);
    for (let i = 0; i < split.length; i++) {
      processTags();
      chunks.push(split.charAt(i));
      currentLength++;
      processTags();
    }

    const matchedPattern = match[0];
    for (let i = 0; i < matchedPattern.length; i++) {
      if (i === 0) chunks.push(wrapper.prefix);
      processTags();
      chunks.push(matchedPattern.charAt(i));
      if (i === matchedPattern.length - 1) chunks.push(wrapper.suffix);
      currentLength++;
      processTags();
    }
    lastIndex = match.index! + matchedPattern.length;
  }

  const lastSplit = plaintext.slice(lastIndex);
  for (let i = 0; i < lastSplit.length; i++) {
    processTags();
    chunks.push(lastSplit.charAt(i));
    currentLength++;
    processTags();
  }

  processTags();

  const extraTags = tags.slice(tagsIndex);
  if (extraTags.length > 0) {
    console.error(extraTags);
    // throw new Error("Extra tags!");
  }

  return chunks.join("");
}
