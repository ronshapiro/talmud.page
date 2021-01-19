import {Attributes, HtmlVisitor, NO_END_TAGS} from "./html_visitor";

class FootnotesVisitor extends HtmlVisitor {
  private currentFootnote: string[] = [];
  private inFootnote = false;
  private footnoteTagStackCount = 0;
  private lastStartTag = "";
  private lastText = "";

  constructor(readonly footnotes: string[]) {
    super();
  }

  shouldRun(input: string): boolean {
    return input.includes('"footnote"');
  }

  visitStartTag(tag: string, attributes: Attributes): void {
    if (this.inFootnote) {
      if (!NO_END_TAGS.has(tag)) {
        this.footnoteTagStackCount++;
      }
      this.appendStartTag(tag, attributes, this.currentFootnote);
    } else if (attributes.some(x => x[0] === "class" && x[1].includes("footnote"))) {
      this.inFootnote = true;
      this.footnoteTagStackCount = 0;
      if (this.lastStartTag === "sup") {
        this.currentFootnote.push(`<sup>${this.lastText}</sup> `);
      }
    } else {
      this.appendStartTag(tag, attributes);
    }

    this.lastStartTag = tag;
  }

  visitEndTag(tag: string): void {
    if (this.inFootnote) {
      if (this.footnoteTagStackCount === 0) {
        this.inFootnote = false;
        this.footnotes.push(this.currentFootnote.join(""));
        this.currentFootnote = [];
      } else {
        this.footnoteTagStackCount--;
        this.appendEndTag(tag, this.currentFootnote);
      }
    } else {
      this.appendEndTag(tag);
    }
  }

  visitText(text: string): void {
    if (this.inFootnote) {
      this.currentFootnote.push(text);
    } else {
      this.appendText(text);
    }
    this.lastText = text;
  }
}

interface ExtractResult {
  comment: sefaria.TextResponse,
  footnotes: sefaria.TextResponse[],
}

export class FootnotesExtractor {
  static extract(comment: sefaria.TextResponse): ExtractResult {
    const [hebrew, hebrewFootnotes] = FootnotesExtractor.tryExtract(comment.he);
    const [english, englishFootnotes] = FootnotesExtractor.tryExtract(comment.text);
    const footnotes: sefaria.TextResponse[] = [];

    for (let i = 0; i < Math.max(hebrewFootnotes.length, englishFootnotes.length); i++) {
      footnotes.push({
        he: hebrewFootnotes[i] ?? "",
        text: englishFootnotes[i] ?? "",
        ref: `Footnote ${i + 1} on ${comment.ref}`,
      });
    }

    return {
      comment: {
        ...comment,
        he: hebrew,
        text: english,
      },
      footnotes,
    };
  }

  private static tryExtract(
    text: sefaria.TextType,
  ): [sefaria.TextType, string[]] {
    const footnotes: string[] = [];
    const processedText = FootnotesVisitor.process(
      text, /* englishName */ undefined, () => new FootnotesVisitor(footnotes));
    return [processedText, footnotes];
  }
}
