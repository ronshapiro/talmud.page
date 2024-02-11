export const options: any = {};

function hasNoEndTag(tag) {
  return tag === "img" || tag === "br";
}

function getDocument(): Document {
  return options.document || document;
}

class AbstractTag {
  tag: string;

  hasNoEndTag() {
    return this.tag === "img" || this.tag === "br";
  }
}

class StartTag extends AbstractTag {
  constructor(
    readonly tag: string,
    // do not submit: rename
    readonly startLocation: number,
    readonly length: number,
    readonly attributes: NamedNodeMap,
  ) {
    super();
  }

  // do not submit: consider using the html_visitor.ts logic to simplify things
  asText(): string {
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

}

class EndTag extends AbstractTag {
  constructor(readonly tag: string, readonly startLocation: number) {
    super();
    this.length = 0;
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
  const tags = [];
  function dfs(node: Node) {
    if (node.nodeName === "#text") {
      currentText += node.textContent;
    } else {
      tags.push(
        new StartTag(node.localName, currentText.length, node.textContent.length, node.attributes));
    }

    for (const child of Array.from(node.childNodes)) {
      dfs(child);
    }

    if (node.nodeName !== "#text") {
      tags.push(new EndTag(node.localName, currentText.length));
    }
  }

  const el = getDocument().createElement('z');
  el.innerHTML = sourceText;
  const expectedPlaintext = el.textContent;

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

export interface Wrapper {
  prefix: string;
  suffix: string;
}

export function htmlWrapMatches(
  sourceText: string, pattern: string, wrapper: Wrapper,
): string {
  return htmlWrapMatchesWithPattern(sourceText, new RegExp(pattern, "g"), wrapper);
  // do not submit: assert pattern is sanitized!
  const [plaintext, tags] = extract(sourceText);
  let currentLength = 0;
  let tagsIndex = 0;
  const chunks = [];
  const splits = plaintext.split(pattern);

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

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i];
    for (let j = 0; j < split.length; j++) {
      processTags();
      chunks.push(split.charAt(j));
      currentLength++;
      processTags();
    }

    if (i !== splits.length - 1) {
      for (let j = 0; j < pattern.length; j++) {
        if (j === 0) chunks.push(wrapper.prefix);
        processTags();
        chunks.push(pattern.charAt(j));
        if (j === pattern.length - 1) chunks.push(wrapper.suffix);
        currentLength++;
        processTags();
      }
    }
  }
  processTags();

  const extraTags = tags.slice(tagsIndex);
  if (extraTags.length > 0) {
    console.error(extraTags);
    // throw new Error("Extra tags!");
  }

  return chunks.join("");
}

export function htmlWrapMatchesWithPattern(
  sourceText: string, pattern: RegExp, wrapper: Wrapper,
): string {
  // do not submit: assert pattern is sanitized!
  const [plaintext, tags] = extract(sourceText);
  let currentLength = 0;
  let tagsIndex = 0;
  const chunks = [];
  const splits = plaintext.split(pattern);

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

  const matches = Array.from(sourceText.matchAll(pattern));
  /*
  if (matches.length > 0) {
    const lastSyntheticMatch = [sourceText.slice(matches.at(-1).index)];
    lastSyntheticMatch.index = 9999999;
    matches.push(lastSyntheticMatch);
  }*/

  let lastIndex = 0;
  for (const match of matches) {
    const split = sourceText.slice(lastIndex, match.index);
    for (let i = 0; i < split.length; i++) {
      processTags();
      chunks.push(split.charAt(i));
      currentLength++;
      processTags();
    }

    const pattern = match[0];
    for (let i = 0; i < pattern.length; i++) {
      if (i === 0) chunks.push(wrapper.prefix);
      processTags();
      chunks.push(pattern.charAt(i));
      if (i === pattern.length - 1) chunks.push(wrapper.suffix);
      currentLength++;
      processTags();
    }
    lastIndex = match.index + pattern.length;
  }

  const lastSplit = sourceText.slice(lastIndex);
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
