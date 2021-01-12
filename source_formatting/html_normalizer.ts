import {Attributes, HtmlVisitor} from "./html_visitor";

/**
 * This doesn't seem like it does much, but it does normalize quirks in the HTML that may be
 * passed to HtmlVisitors.
 */
export class HtmlNormalizer extends HtmlVisitor {
  visitStartTag(tag: string, attributes: Attributes): void {
    this.appendStartTag(tag, attributes);
  }

  visitEndTag(tag: string): void {
    this.appendEndTag(tag);
  }

  visitText(text: string): void {
    this.appendText(text);
  }
}
