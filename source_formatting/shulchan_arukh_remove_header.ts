import {Attributes, HtmlVisitor} from "./html_visitor";

export class ShulchanArukhHeaderRemover extends HtmlVisitor {
  tagStack: string[] = []
  processingHeader = false
  doneProcessingHeader = false

  visitStartTag(tag: string, attributes: Attributes): void {
    if (this.doneProcessingHeader && tag === "br" && this.tagStack.length === 0) {
      return;
    }

    this.tagStack.push(tag);
    if (!this.doneProcessingHeader && tag === "b" && this.tagStack.length === 1 && this.tagStack[0] === "b") {
      this.processingHeader = true;
      return;
    }

    if (this.processingHeader) {
      return;
    }

    this.appendStartTag(tag, attributes);
  }

  visitEndTag(tag: string): void {
    this.tagStack.pop();

    if (!this.doneProcessingHeader && tag === "b" && this.tagStack.length === 0) {
      this.doneProcessingHeader = true;
      this.processingHeader = false;
      return;
    }

    if (this.processingHeader) {
      return;
    }

    this.appendEndTag(tag);
  }

  visitText(text: string): void {
    if (!this.processingHeader) {
      this.appendText(text);
    }
  }
}
