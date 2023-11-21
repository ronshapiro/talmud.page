import {Book} from "./books";
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
): string | undefined {
  return SUGYA_POINTERS_CACHE[masechet][ref];
}

export function getSugyaSpanningRef(masechet: string, ref: string): string | undefined {
  if (masechet in SUGYA_POINTERS_CACHE) {
    const result = getSugyaSpanningRefWithDefiniteCacheHit(masechet, ref);
    // It's already a spanning ref, but Sefaria doesn't provide the span ourselves, so let's try
    // to create it ourselves.
    if (!result && ref.includes("-")) {
      // TODO: there's more sophisticated work that can be done here, but the complexity doesn't
      // seem like it's worth it.
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

export function mishnaReferencePath(book: Book): string {
  return `precomputed/mishna_references/${book.canonicalName}.json`;
}

const MISHNA_REFERENCES_CACHE: Record<string, Record<string, Record<string, string>>> = {};

export function mishnaReferencesForPage(book: Book, page: string): Record<string, string> {
  if (book.canonicalName in MISHNA_REFERENCES_CACHE) {
    return MISHNA_REFERENCES_CACHE[book.canonicalName][page] ?? {};
  }
  MISHNA_REFERENCES_CACHE[book.canonicalName] = JSON.parse(readUtf8(mishnaReferencePath(book)));
  return mishnaReferencesForPage(book, page);
}

const SEGMENT_COUNT_CACHE: Record<string, number> = {};

export function segmentCount(pageRef: string): number {
  if (Object.keys(SEGMENT_COUNT_CACHE).length === 0) {
    Object.assign(
      SEGMENT_COUNT_CACHE,
      JSON.parse(readUtf8("precomputed/segmentsPerPage.json")));
  }
  return SEGMENT_COUNT_CACHE[pageRef];
}
