import {Attributes, HtmlVisitor} from "./html_visitor";

export class SectionSymbolRemover extends HtmlVisitor {
  isAtStart = true;

  visitStartTag(tag: string, attributes: Attributes): void {
    this.appendStartTag(tag, attributes);
  }

  visitEndTag(tag: string): void {
    this.appendEndTag(tag);
  }

  visitText(text: string): void {
    if (this.isAtStart) {
      this.isAtStart = false;
      text = text.replace(/^§ ?/, "");
    }
    this.appendText(text);
  }
}
