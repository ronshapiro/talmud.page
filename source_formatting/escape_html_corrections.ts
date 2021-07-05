import {htmlEscape} from "../html_escape";
import {Attributes, HtmlVisitor} from "./html_visitor";

// This is intentional - we want a value that is not identical to any other value
// eslint-disable-next-line no-new-wrappers,unicorn/new-for-builtins
const startPlaceholder = new String() as string;
// eslint-disable-next-line no-new-wrappers,unicorn/new-for-builtins
const endPlaceholder = new String() as string;


function isInstance(a: string, b: string): boolean {
  // eslint-disable-next-line eqeqeq
  return a == b;
}

export class EscapeHtmlHighlightCorrections extends HtmlVisitor {
  spanTags = 0;
  startSpans: string[] = [];

  visitStartTag(tag: string, attributes: Attributes): void {
    if (tag === "span") {
      this.spanTags++;
      if (this.spanTags === 1
        && attributes.length === 1
        && attributes[0][0] === "style"
        && attributes[0][1] === "background: rgb(255, 201, 135);") {
        this.appendText(startPlaceholder);
        const span: string[] = [];
        this.appendStartTag(tag, attributes, span);
        this.startSpans.push(span.join(""));
        return;
      }
    }
    this.appendStartTag(tag, attributes);
  }

  visitEndTag(tag: string): void {
    if (tag === "span") {
      this.spanTags--;
      if (this.spanTags === 0) {
        this.appendText(endPlaceholder);
        return;
      }
    }
    this.appendEndTag(tag);
  }

  visitText(text: string): void {
    this.appendText(text);
  }

  beforeJoin(): void {
    for (let i = 0; i < this._out.length; i++) {
      const piece = this._out[i];
      if (isInstance(piece, startPlaceholder)) {
        this._out[i] = this.startSpans.shift() as string;
      } else if (isInstance(piece, endPlaceholder)) {
        this._out[i] = "</span>";
      } else {
        this._out[i] = htmlEscape(this._out[i]);
      }
    }
  }
}
