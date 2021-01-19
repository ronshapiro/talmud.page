import {JSDOM} from "jsdom";

const {Node, DOMParser} = new JSDOM().window;
const domParser = new DOMParser();

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isText(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

export type Attributes = [string, string][];

export const NO_END_TAGS = new Set(["br", "img"]);

type MultiDimensionalString = string[] | MultiDimensionalString[];

export class HtmlVisitor {
  englishNameIgnore: Set<string | undefined> = new Set([]);
  englishNamesToProcess: Set<string | undefined> | undefined;
  _out: string[] = []

  static process<T extends string | MultiDimensionalString>(
    inputs: T,
    englishName?: string,
    createVisitor = () => new this(),
  ): T {
    if (Array.isArray(inputs)) {
      // @ts-ignore
      return inputs.map(x => this.process(x, englishName, createVisitor)) as T;
    }
    const visitor = createVisitor();
    if (visitor.englishNamesToProcess) {
      if (!visitor.englishNamesToProcess.has(englishName)) {
        // @ts-ignore
        return inputs;
      }
    } else if (visitor.englishNameIgnore.has(englishName)) {
      // @ts-ignore
      return inputs;
    }

    // @ts-ignore
    return visitor.processSingle(inputs);
  }

  processSingle(input: string): string {
    // This may seem insignificant, but this optimization can shave 100s of ms per request
    // By saving on unnecessary DOM parsing
    // TODO: consider using https://www.npmjs.com/package/fast-html-parser
    if (!this.shouldRun(input)) {
      return input;
    }

    domParser.parseFromString(input, "text/html").body.childNodes
      .forEach(x => this.visit(x));

    this.beforeJoin();
    return this._out.join("");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shouldRun(input: string): boolean {
    return true;
  }

  visit(node: Node): void {
    if (isElement(node)) {
      const tag = node.nodeName.toLowerCase();
      this.visitStartTag(tag, Array.from(node.attributes).map(x => [x.name, x.value]));

      node.childNodes.forEach(x => this.visit(x));

      if (!NO_END_TAGS.has(tag)) {
        this.visitEndTag(tag);
      }
    } else if (isText(node)) {
      this.visitText(node.data);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitStartTag(tag: string, attributes: Attributes): void {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitEndTag(tag: string): void {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitText(text: string): void {
    throw new Error("Unimplemented");
  }

  beforeJoin(): void {}

  appendStartTag(tag: string, attributes: Attributes, to: string[] = this._out): void {
    to.push(`<${tag}`);
    for (const [key, value] of attributes) {
      to.push(` ${key}="${value}"`);
    }
    to.push(">");
  }

  appendText(text: string): void {
    this._out.push(text);
  }

  appendEndTag(tag: string, to: string[] = this._out): void {
    to.push(`</${tag}>`);
  }
}
