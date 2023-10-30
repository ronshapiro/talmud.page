import * as fs from "fs";
import {Amud} from "./apiTypes";
import {books, Book} from "./books";
import {cachedOutputFilePath} from "./cached_outputs";
import {writeJson} from "./util/json_files";

function mergeRefs(book: Book, start: string, end: string): string {
  const startPrefix = start.split(":")[0];
  const [endPrefix, endSuffix] = end.split(":");
  if (startPrefix === endPrefix) {
    return `${start}-${endSuffix}`;
  }
  const endAmud = end.replace(book.canonicalName + " ", "");
  return `${start}-${endAmud}`;
}

for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  if (!book.isMasechet()) continue;
  if (book.canonicalName === "Shekalim") continue;

  const sugyaEndpoints: any[] = [];
  const perekEndpoints = [];
  const refPointers: any = {reverse: {}};

  let perekStart: string | undefined;
  let refsInSugya: string[] = [];

  const saveSugya = () => {
    if (refsInSugya.length > 0) {
      const start = refsInSugya[0];
      const end = refsInSugya.at(-1)!;
      sugyaEndpoints.push({start, end, length: refsInSugya.length});

      for (const ref of refsInSugya) {
        const sugyaRef = mergeRefs(book, start, end);
        if (refsInSugya.length > 1) {
          refPointers[ref] = sugyaRef;
          refPointers.reverse[sugyaRef] = refsInSugya;
        }
      }
    }
  };

  for (const section of Array.from(book.sections)) {
    const result = JSON.parse(
      fs.readFileSync(cachedOutputFilePath(book, section), {encoding: "utf-8"})) as Amud;

    for (const segment of result.sections) {
      const isHadran = segment.ref === "Hadran 1";
      if (segment.steinsaltz_start_of_sugya || isHadran) {
        saveSugya();
        refsInSugya = [];
      }
      if (isHadran) {
        break;
      }
      refsInSugya.push(segment.ref);

      if (perekStart === undefined) {
        perekStart = segment.ref;
      } else if (segment.hadran) {
        perekEndpoints.push({start: perekStart, end: segment.ref});
        perekStart = undefined;
      }
    }
  }

  writeJson(`sugyot/${book.canonicalName}.json`, sugyaEndpoints);
  writeJson(`sugya_pointers/${book.canonicalName}-pointers.json`, refPointers);
  writeJson(`masechet_prakim/${book.canonicalName}.json`, perekEndpoints);
}
