import {DateTime} from "luxon";
import {books} from "../books";
import {RealRequestMaker} from "../request_makers";
import {expandRef} from "../ref_expander";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {ApiResponse} from "../apiTypes";
import {writeJson} from "../util/json_files";
import {splitOnBookName} from "../refs";

async function getCalendars(): Promise<any> {
  const today = DateTime.now();
  const requestMaker = new RealRequestMaker();
  const promises = [];
  for (let i = 0; i < 52 * 10; i++) {
    const day = today.plus({days: i * 7});
    promises.push(
      requestMaker.makeRequest(`/calendars?year=${day.year}&month=${day.month}&day=${day.day}`));
    // eslint-disable-next-line no-await-in-loop
    if (i % 100 === 0) await Promise.all(promises); // throttle outgoing requests
  }

  return Promise.all(promises);
}

async function aliyaStartsAndEnds(): Promise<[Set<string>, Set<string>]> {
  const items = [];
  for (const calendar of await getCalendars()) {
    for (const item of calendar.calendar_items) {
      if (item.title.en === "Parashat Hashavua"
        && !item.displayValue.en.includes("Shabbat")
         && item.extraDetails.aliyot.length === 8) {
        items.push(item);
      }
    }
  }

  const aliyaStarts = new Set<string>();
  const aliyaEnds = new Set<string>();
  for (const item of items) {
    for (const aliya of item.extraDetails.aliyot.slice(0, 7)) {
      const refs = expandRef(aliya)!;
      aliyaStarts.add(refs[0]);
      aliyaEnds.add(refs.at(-1)!);
    }
  }
  return [aliyaStarts, aliyaEnds];
}

const CACHE_FILE = "precomputed/tanakh_passage_mappings.json";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function main() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [starts, ends] = await aliyaStartsAndEnds();
  const result: Record<string, string> = {};
  for (const book of new Set(Object.values(books.byCanonicalName))) {
    if (!book.isBibleBook()) continue;

    let versesInCurrentSection: string[] = [];
    const commitSection = () => {
      if (versesInCurrentSection.length === 0) return;
      const endChapterAndVerse = splitOnBookName(versesInCurrentSection.at(-1)!)[1];
      const range = `${versesInCurrentSection[0]}-${endChapterAndVerse}`;
      for (const ref of versesInCurrentSection) {
        result[ref] = range;
      }
      versesInCurrentSection = [];
    };

    for (const chapter of book.sections) {
      const response: ApiResponse = JSON.parse(readUtf8(cachedOutputFilePath(book, chapter)));
      for (const verse of response.sections) {
        versesInCurrentSection.push(verse.ref);
        if (verse.lastSegmentOfSection || ends.has(verse.ref)) {
          commitSection();
        }
      }
    }
    commitSection();
  }
  writeJson(CACHE_FILE, result);
}

if (require.main === module) {
  main();
}

let cache: Record<string, string> = {};

export function getTanakhPassage(ref: string): string[] | undefined {
  if (!cache["Genesis 1"]) {
    cache = JSON.parse(readUtf8(CACHE_FILE)) as Record<string, string>;
  }
  const cacheValue = cache[ref];
  if (!cacheValue) return undefined;
  return expandRef(cacheValue)!;
}
