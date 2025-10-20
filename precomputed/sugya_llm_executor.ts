import * as fs from "fs";
import {Amud, Section} from "../apiTypes";
import {books, Book} from "../books"; // eslint-disable-line @typescript-eslint/no-unused-vars
import {cachedOutputFilePath} from "../cached_outputs";

export function indexSugyotByStartRef(book: Book): Record<string, Section[]> {
  const sugyot = JSON.parse(
    fs.readFileSync(`precomputed/sugyot/${book.canonicalName}.json`, {encoding: "utf-8"}));
  let bookSectionIndex = 0;
  let sectionSegmentIndex = 0;
  let inSugya = false;
  const bookSections = Array.from(book.sections);
  const sugyaSections: Record<string, Section[]> = {};
  for (const sugya of sugyot) {
    while (bookSectionIndex < bookSections.length) {
      const section = bookSections[bookSectionIndex];
      const parsedSection = JSON.parse(
        fs.readFileSync(cachedOutputFilePath(book, section), {encoding: "utf-8"})) as Amud;

      while (sectionSegmentIndex < parsedSection.sections.length) {
        const segment = parsedSection.sections[sectionSegmentIndex];
        if (segment.steinsaltz_start_of_sugya) delete segment.steinsaltz_start_of_sugya;
        if (segment.ref === sugya.start) {
          sugyaSections[sugya.start] = [segment];
          inSugya = sugya.start !== sugya.end;
        } else if (segment.ref === sugya.end) {
          sugyaSections[sugya.start]!.push(segment);
          inSugya = false;
        } else if (inSugya) {
          sugyaSections[sugya.start]!.push(segment);
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
  return sugyaSections;
}

export function chapterSugyot(book: Book): Section[][][] {
  const res = indexSugyotByStartRef(book);
  const starts = Array.from(Object.keys(res));
  const byChapter: Section[][][] = [];
  let currentChapter: Section[][] = [];
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

/*
for (const book of books.allBooks) {
  if (!book.isTalmud()) continue;
  console.log(book.canonicalName, chapterSugyot(book).at(-1)!.at(-1))
}
*/
