import {Attributes, HtmlVisitor} from "./html_visitor";

const _PREFIXES_TO_STRIP = [
  "גמ'",
  "מתני'",
].map(x => `${x} `);

export class CommentaryPrefixStripper extends HtmlVisitor {
  hasProcessedText = false

  visitStartTag(tag: string, attributes: Attributes): void {
    this.appendStartTag(tag, attributes);
  }

  visitEndTag(tag: string): void {
    this.appendEndTag(tag);
  }

  visitText(text: string): void {
    if (!this.hasProcessedText) {
      for (const prefix of _PREFIXES_TO_STRIP) {
        if (text.startsWith(prefix)) {
          text = text.substring(prefix.length);
        }
      }
      this.hasProcessedText = true;
    }

    this.appendText(text);
  }
}
