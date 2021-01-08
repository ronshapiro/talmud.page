import {JSDOM} from "jsdom";

const {Node} = new JSDOM().window;

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isText(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

export type Attributes = [string, string][];

const NO_END_TAGS = new Set(["br", "img"]);

type MultiDimensionalString = string[] | MultiDimensionalString[];

export class HtmlVisitor {
  englishNameIgnore: Set<string | undefined> = new Set([]);
  englishNamesToProcess: Set<string | undefined> | undefined;
  _out: string[] = []

  static process<T extends string | MultiDimensionalString>(inputs: T, englishName?: string): T {
    if (Array.isArray(inputs)) {
      // @ts-ignore
      return inputs.map(x => this.process(x)) as T;
    }
    const visitor = new this();
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
    new JSDOM(input).window.document.body.childNodes.forEach(x => this.visit(x));
    this.beforeJoin();
    return this._out.join("");
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

  appendStartTag(tag: string, attrs: Attributes, to: string[] = this._out): void {
    to.push(`<${tag}`);
    for (const attr of attrs) {
      to.push(` ${attr[0]}="${attr[1]}"`);
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
