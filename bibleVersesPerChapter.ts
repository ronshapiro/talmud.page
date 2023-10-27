import * as fs from "fs";
import {Amud} from "./apiTypes";
import {books} from "./books";
import {cachedOutputFilePath} from "./cached_outputs";
import {writeJson} from "./util/json_files";

const versesPerChapter: Record<string, number> = {};

for (const book of Object.values(books.byCanonicalName)) {
  if (!book.isBibleBook()) continue;
  for (const section of Array.from(book.sections)) {
    const result = JSON.parse(
      fs.readFileSync(cachedOutputFilePath(book, section), {encoding: "utf-8"})) as Amud;
    versesPerChapter[`${book.canonicalName} ${section}`] = result.sections.length;
  }
}

writeJson("bibleVersesPerChapter.json", versesPerChapter);
