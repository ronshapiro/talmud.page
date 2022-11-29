import {DateTime} from "luxon";
import {books} from "./books";

const PREFIX = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
const SUFFIX = "</urlset>";

export class Sitemap {
  constructor(private readonly baseUrl: string) {}

  private pageXml(url: string): string {
    const lastmod = DateTime.now().startOf("month").toISODate();
    return `<url>
  <loc>${this.baseUrl}/${url}</loc>
  <lastmod>${lastmod}</lastmod>
</url>`;
  }

  generate(): string {
    const sections = [PREFIX];
    for (const [name, book] of Object.entries(books.byCanonicalName)) {
      const canonicalName = books.canonicalUrlName(name);
      if (book.bookType() === "Siddur") {
        sections.push(this.pageXml(canonicalName));
      } else {
        for (const section of Array.from(book.sections)) {
          sections.push(this.pageXml(`${canonicalName}/${section}`));
        }
      }
    }
    sections.push(this.pageXml("daf-yomi"));
    sections.push(this.pageXml("preferences"));
    if (sections.length > 50_000) {
      throw new Error("Only 50k entries are allowed per sitemap");
    }
    sections.push(SUFFIX);
    return sections.join("\n");
  }
}
