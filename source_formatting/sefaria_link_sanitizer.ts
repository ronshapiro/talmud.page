import {Attributes, HtmlVisitor} from "./html_visitor";

export class SefariaLinkSanitizer extends HtmlVisitor {
  anchorStack: (string | false)[] = [];

  processSingle(input: string): string {
    return super.processSingle(input.replace("&nbsp;", "__nbsp__")).replace("__nbsp__", "&nbsp;");
  }

  shouldRun(input: string): boolean {
    return input.includes("href");
  }

  visitStartTag(tag: string, attributes: Attributes): void {
    if (tag === "a") {
      this.visitStartAnchor(attributes);
    } else {
      this.appendStartTag(tag, attributes);
    }
  }

  visitStartAnchor(attributes: Attributes): void {
    const classes = attributes.filter(([name, _]) => name === "class");
    if (classes.length !== 1) {
      return;
    }

    const clazz = classes[0][1];
    if (clazz === "namedEntityLink" || clazz === "refLink") {
      this.appendStartTag("span", attributes);
      this.anchorStack.push("span");
    } else {
      this.anchorStack.push(false);
    }
  }

  visitEndTag(tag: string): void {
    if (tag === "a") {
      const replacedTag = this.anchorStack.pop();
      if (replacedTag) {
        this.appendEndTag(replacedTag);
      }
    } else {
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
