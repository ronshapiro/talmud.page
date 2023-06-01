import * as fs from "fs";
import {Amud} from "./apiTypes";
import {books} from "./books";
import {cachedOutputFilePath} from "./cached_outputs";
import {writeJson} from "./util/json_files";

for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  if (!book.isMasechet()) continue;
  if (book.canonicalName === "Shekalim") continue;

  const sugyaEndpoints = [];
  const perekEndpoints = [];

  let sugyaStart: string | undefined;
  let sugyaLength = 0;
  let perekStart: string | undefined;
  let lastSegment: string | undefined;
  for (const section of Array.from(book.sections)) {
    const result = JSON.parse(
      fs.readFileSync(cachedOutputFilePath(book, section), {encoding: "utf-8"})) as Amud;
    for (const segment of result.sections) {
      sugyaLength++;
      if (sugyaStart === undefined) {
        sugyaStart = segment.ref;
        sugyaLength = 1;
      } else if (segment.steinsaltz_start_of_sugya) {
        sugyaEndpoints.push({start: sugyaStart, end: lastSegment, length: sugyaLength});
        sugyaStart = undefined;
      }

      if (perekStart === undefined) {
        perekStart = segment.ref;
      } else if (segment.hadran) {
        perekEndpoints.push({start: perekStart, end: segment.ref});
        perekStart = undefined;
      }

      lastSegment = segment.ref;
    }
  }

  writeJson(`sugyot/${book.canonicalName}.json`, sugyaEndpoints);
  writeJson(`masechet_prakim/${book.canonicalName}.json`, perekEndpoints);
}
