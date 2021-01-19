import {Attributes, HtmlVisitor} from "./html_visitor";

export class CommentaryParenthesesTransformer extends HtmlVisitor {
  englishNameIgnore = new Set(["Steinsaltz", "Shulchan Arukh", "Mishneh Torah"])

  shouldRun(input: string): boolean {
    // TODO: this isn't perfect since it doesn't checked for balancedness
    return input.includes("(") || input.includes(")");
  }

  visitStartTag(tag: string, attributes: Attributes): void {
    this.appendStartTag(tag, attributes);
  }

  visitEndTag(tag: string): void {
    this.appendEndTag(tag);
  }

  visitText(text: string): void {
    this.appendText(
      text
        .replace(/\(/g, '<span class="parenthesized">(')
        .replace(/\)/g, ')</span>'));
  }
}
