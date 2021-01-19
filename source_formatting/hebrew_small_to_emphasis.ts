import {Attributes, HtmlVisitor} from "./html_visitor";

export class HebrewSmallToEmphasisTagTranslator extends HtmlVisitor {
  shouldRun(input: string): boolean {
    return input.includes("<small");
  }

  visitStartTag(tag: string, attributes: Attributes): void {
    if (tag === "small") {
      this.appendStartTag("span", [["class", "hebrew-emphasis"]]);
    } else {
      this.appendStartTag(tag, attributes);
    }
  }

  visitEndTag(tag: string): void {
    this.appendEndTag(tag === "small" ? "span" : tag);
  }

  visitText(text: string): void {
    this.appendText(text);
  }
}
