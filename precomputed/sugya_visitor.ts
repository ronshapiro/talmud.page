import * as fs from "fs";
import {Amud, Section as Segment} from "../apiTypes";
import {Book} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";

export type Sugya = Segment[];
type Chapter = Sugya[];

export function indexSugyotByStartRef(book: Book): Record<string, Sugya> {
  const sugyot = JSON.parse(
    fs.readFileSync(`precomputed/sugyot/${book.canonicalName}.json`, {encoding: "utf-8"}));
  let bookSectionIndex = 0;
  let sectionSegmentIndex = 0;
  let inSugya = false;
  const bookSections = Array.from(book.sections);
  const sugyaSegments: Record<string, Sugya> = {};
  for (const sugya of sugyot) {
    while (bookSectionIndex < bookSections.length) {
      const section = bookSections[bookSectionIndex];
      const parsedSection = JSON.parse(
        fs.readFileSync(cachedOutputFilePath(book, section), {encoding: "utf-8"})) as Amud;

      while (sectionSegmentIndex < parsedSection.sections.length) {
        const segment = parsedSection.sections[sectionSegmentIndex];
        if (segment.steinsaltz_start_of_sugya) delete segment.steinsaltz_start_of_sugya;
        if (segment.ref === sugya.start) {
          sugyaSegments[sugya.start] = [segment];
          inSugya = sugya.start !== sugya.end;
        } else if (segment.ref === sugya.end) {
          sugyaSegments[sugya.start]!.push(segment);
          inSugya = false;
        } else if (inSugya) {
          sugyaSegments[sugya.start]!.push(segment);
        }
        sectionSegmentIndex++;
        if (!inSugya) break;
      }
      if (inSugya || (!inSugya && (sectionSegmentIndex === parsedSection.sections.length))) {
        bookSectionIndex++;
        sectionSegmentIndex = 0;
      }
      if (!inSugya) break;
    }
  }
  return sugyaSegments;
}

export function chapterSugyot(book: Book): Chapter[] {
  const res = indexSugyotByStartRef(book);
  const starts = Array.from(Object.keys(res));
  const byChapter: Chapter[] = [];
  let currentChapter: Chapter = [];
  for (let i = 0; i < starts.length; i++) {
    const current = res[starts[i]];
    if (current.at(-1)?.hadran) {
      currentChapter.push(current.slice(0, -1));
      byChapter.push(currentChapter);
      currentChapter = [];
    } else {
      currentChapter.push(current);
    }
  }
  return byChapter;
}

interface SugyotDiffOptions {
  sugyotBefore?: number;
  sugyotAfter?: number;
}

interface SugyotVisitOptions {
  diff?: SugyotDiffOptions;
}
type Visitor =
  ((sugya: Sugya) => void) |
  ((sugya: Sugya, before: Sugya[], after: Sugya[]) => void);

export function visitSugyot(book: Book, options: SugyotVisitOptions, visitor: Visitor): void {
  for (const chapter of chapterSugyot(book)) {
    for (let i = 0; i < chapter.length; i++) {
      const before: Sugya[] = [];
      for (let diff = 0; diff < (options?.diff?.sugyotBefore ?? 0); diff++) {
        before.push(chapter[i - diff]);
      }
      const after: Sugya[] = [];
      for (let diff = 0; diff < (options?.diff?.sugyotAfter ?? 0); diff++) {
        before.push(chapter[i + diff]);
      }
      visitor(chapter[i], before.filter(x => x), after.filter(x => x));
    }
  }
}
