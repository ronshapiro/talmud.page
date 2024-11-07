import {Attributes, HtmlVisitor} from "./html_visitor";

const IGNORED_ENTITY_SLUGS = new Set([
  "israel",
  "jewish-people",
]);

export class SefariaTopicCollector extends HtmlVisitor {
  entities = new Set<string>();

  shouldRun(input: string): boolean {
    return input.includes("namedEntityLink");
  }

  visitStartTag(tag: string, attributes: Attributes): void {
    let href = "";
    let found = false;
    for (const [name, value] of attributes) {
      if (name === "href") {
        href = value;
      }
      if (name === "class" && value === "namedEntityLink") {
        found = true;
      }
    }

    if (found && !IGNORED_ENTITY_SLUGS.has(href)) {
      this.entities.add(href);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitEndTag(tag: string): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visitText(text: string): void {}
}
