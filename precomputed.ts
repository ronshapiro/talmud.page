import {readUtf8} from "./files";

const SHULCHAN_ARUKH_HEADERS: any = (
  JSON.parse(readUtf8("precomputed_texts/shulchan_arukh_headings.json"))
);

export function shulchanArukhChapterTitle(ref: string): string | undefined {
  const bookAndChapter = ref.split("Shulchan Arukh, ")[1].split(":")[0];
  const separatorIndex = bookAndChapter.lastIndexOf(" ");
  const book = bookAndChapter.slice(0, separatorIndex);
  const chapter = bookAndChapter.slice(separatorIndex + 1);

  if (book.includes(", Seder ")) {
    return undefined;
  }
  return SHULCHAN_ARUKH_HEADERS[book][chapter];
}

const SUGYA_POINTERS_CACHE: Record<string, Record<string, any>> = {};

export function getSugyaSpanningRefWithDefiniteCacheHit(
  masechet: string, ref: string,
): [string, string[]] | undefined {
  const sugyaRef = SUGYA_POINTERS_CACHE[masechet][ref];
  if (sugyaRef) {
    const foo = SUGYA_POINTERS_CACHE[masechet].reverse[sugyaRef];
    return [sugyaRef, foo];
  }
  return undefined;
}

export function getSugyaSpanningRef(masechet: string, ref: string): [string, string[]] | undefined {
  if (masechet in SUGYA_POINTERS_CACHE) {
    const result = getSugyaSpanningRefWithDefiniteCacheHit(masechet, ref);
    // It's already a spanning ref, but Sefaria doesn't provide the span ourselves, so let's try
    // to create it ourselves.
    if (!result && ref.includes("-")) {
      return getSugyaSpanningRefWithDefiniteCacheHit(masechet, ref.slice(0, ref.indexOf("-")));
    }
    return result;
  }

  let text: string;
  try {
    text = readUtf8(`sugya_pointers/${masechet}-pointers.json`);
  } catch {
    SUGYA_POINTERS_CACHE[masechet] = {};
    return undefined;
  }
  SUGYA_POINTERS_CACHE[masechet] = JSON.parse(text);
  return getSugyaSpanningRef(masechet, ref);
}

const VERSE_COUNT_CACHE: Record<string, number> = {};

export function verseCount(ref: string): number {
  if (Object.keys(VERSE_COUNT_CACHE).length === 0) {
    Object.assign(
      VERSE_COUNT_CACHE,
      JSON.parse(readUtf8("precomputed/segmentsPerPage.json")));
  }
  return VERSE_COUNT_CACHE[ref];
}
