/* eslint-disable no-console */
import * as fs from 'fs';
import {books} from "./books";
import {cachedOutputFilePath} from "./cached_outputs";

for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  if (!book.isTalmud()) continue;
  const missing: string[] = [];
  for (const section of Array.from(book.sections)) {
    if (!fs.existsSync(cachedOutputFilePath(book, section))) {
      missing.push(section);
    }
  }
  if (missing.length > 0) {
    console.log(book.canonicalName + ": " + missing[0] + " - " + missing.at(-1));
  }
}
