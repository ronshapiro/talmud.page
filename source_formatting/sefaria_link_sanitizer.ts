import {Attributes, HtmlVisitor} from "./html_visitor";

export class SefariaLinkSanitizer extends HtmlVisitor {
  processSingle(input: string): string {
    return super.processSingle(input.replace("&nbsp;", "__nbsp__")).replace("__nbsp__", "&nbsp;");
  }

  visitStartTag(tag: string, attributes: Attributes): void {
    if (tag !== "a") {
      this.appendStartTag(tag, attributes);
    }
  }

  visitEndTag(tag: string): void {
    if (tag !== "a") {
      this.appendEndTag(tag);
    }
  }

  visitText(text: string): void {
    // The extra encodings may not be necessary, but it can't hurt... FWIW Jastrow on Sefaria
    // doesn't use them for whatever reason.
    this.appendText(
      text.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;"));
  }
}
