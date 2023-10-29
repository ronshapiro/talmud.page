import * as fs from "fs";
import {Amud, Section as Segment} from "./apiTypes";
import {books, Masechet} from "./books";
import {stripHebrewNonletters} from "./hebrew";

export function hadranSegments(masechetName: string): Segment[] {
  const masechet = books.byCanonicalName[masechetName] as Masechet;
  const page = JSON.parse(
    fs.readFileSync("precomputed_texts/hadran.json", {encoding: "utf-8"})) as Amud;
  for (const segment of page.sections) {
    segment.en = (segment.en as string).replace(/____/g, masechet.canonicalName);
    segment.he = (segment.he as string).replace(
      /<small>\(יאמר שם המסכת\)<\/small>/g, `<strong>${masechet.vocalizedHebrewName}</strong>`);
  }
  return page.sections;
}

const HADRAN_PATTERN = /^((<br>)+<big><strong>)?הדרן עלי?ך .*/;

export function isHadran(text: sefaria.TextType): boolean {
  if (Array.isArray(text)) {
    return isHadran(text[0]);
  }
  return HADRAN_PATTERN.test(stripHebrewNonletters(text));
}
