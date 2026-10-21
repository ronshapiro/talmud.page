import * as fs from "fs";
import {Amud, ApiComment} from "../apiTypes";
import {Book, books} from "../books";
import {hebrewSearchRegex, stripHebrewNonletters} from "../hebrew";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {ToolUseRecord} from "../precomputed/rsi_state/context_usage_log";
import {toFlatArray} from "../sefariaTextType";
import {replaceBase64ImagesWithTempFileLocations} from "./base64_images";

/**
 * The only way a headless task-type call gets more than what its initial prompt inlines (a page
 * skeleton + the target text — see page_skeleton.ts). Deliberately narrow and ref-addressed,
 * unlike raw Read/Grep/Glob filesystem access: there is no operation here that can read an
 * arbitrary file or search across books, so the "wandering into unrelated books for calibration"
 * failure mode documented in RSIAgentDesignRetrospective.md is structurally impossible, not just
 * discouraged. Exposed to `claude -p` exclusively through context_fetch_cli.ts, scoped via
 * `--allowedTools` to a single `Bash(node rsi_orchestrator/context_fetch_cli.js *)` entry.
 */

export interface RefLocation {
  book: Book;
  page: string;
}

/**
 * Parses which book/page a ref belongs to from the ref string itself (e.g.
 * "Rashi on Zevachim 2a:1:1" or "Zevachim 2a:1") — refs always encode this, so no separate
 * book/page argument is needed anywhere in this module's public API.
 *
 * A commentary ref prepends an arbitrary commentator-attribution prefix (e.g. "Rashi on ") ahead
 * of the base location. Rather than special-casing that literal " on " text — which isn't a
 * documented part of Sefaria's ref format and would break silently for any other prefix shape —
 * this tries every space-separated suffix of the ref, left to right, through `books.parse()` (the
 * same book-name/alias matching the rest of the app uses for query strings) until one resolves.
 * The base location is always such a suffix, so this finds it structurally instead of by
 * string convention.
 */
export function parseRefLocation(ref: string): RefLocation | undefined {
  const tokens = ref.split(" ");
  for (let start = 0; start < tokens.length; start++) {
    const candidate = tokens.slice(start).join(" ");
    const colonIndex = candidate.indexOf(":");
    const pageQuery = colonIndex === -1 ? candidate : candidate.slice(0, colonIndex);
    try {
      const result = books.parse(pageQuery);
      return {book: books.byCanonicalName[result.bookName], page: result.start};
    } catch {
      // Not a valid "<book> <page>" starting at this token — try a shorter suffix.
    }
  }
  return undefined;
}

export interface RefEntry {
  ref: string;
  he: string;
  en: string;
}

function indexAmud(amud: Amud): Map<string, RefEntry> {
  const index = new Map<string, RefEntry>();
  const visitComment = (comment: ApiComment): void => {
    index.set(comment.ref, {
      ref: comment.ref,
      he: replaceBase64ImagesWithTempFileLocations(
        toFlatArray(comment.he).join(" "),
        {ref: comment.ref},
      ),
      en: replaceBase64ImagesWithTempFileLocations(
        toFlatArray(comment.en).join(" "),
        {ref: comment.ref},
      ),
    });
    for (const commentary of Object.values(comment.commentary ?? {})) {
      for (const nested of commentary.comments) visitComment(nested);
    }
  };
  for (const segment of amud.sections) {
    index.set(segment.ref, {
      ref: segment.ref,
      he: replaceBase64ImagesWithTempFileLocations(
        toFlatArray(segment.he).join(" "),
        {ref: segment.ref},
      ),
      en: replaceBase64ImagesWithTempFileLocations(
        toFlatArray(segment.en).join(" "),
        {ref: segment.ref},
      ),
    });
    for (const commentary of Object.values(segment.commentary ?? {})) {
      for (const comment of commentary.comments) visitComment(comment);
    }
  }
  return index;
}

function loadAmud(book: Book, page: string): Amud | undefined {
  const filePath = cachedOutputFilePath(book, page);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(readUtf8(filePath)) as Amud;
}

// Scoped to a single CLI process's lifetime (one `context_fetch_cli` invocation) — cheap
// insurance against re-parsing the same page twice within one getRefs call that spans e.g. a
// segment and a comment on it.
const pageIndexCache = new Map<string, Map<string, RefEntry> | undefined>();

function getPageIndex(book: Book, page: string): Map<string, RefEntry> | undefined {
  const key = `${book.canonicalName}|${page}`;
  if (!pageIndexCache.has(key)) {
    const amud = loadAmud(book, page);
    pageIndexCache.set(key, amud ? indexAmud(amud) : undefined);
  }
  return pageIndexCache.get(key);
}

/** Real CLI invocations are one-shot processes, so this cache resets naturally between them —
 * this reset is only needed so tests (which share a module instance across cases) don't see a
 * stale cache entry from an earlier case that wrote/removed the same fixture file. */
export function resetPageIndexCacheForTests(): void {
  pageIndexCache.clear();
}

export const MAX_REFS_PER_CALL = 20;
export const MAX_CHARS_PER_CALL = 6000;

export interface GetRefsResultEntry {
  ref: string;
  he?: string;
  en?: string;
  error?: string;
}

export interface GetRefsResult {
  entries: GetRefsResultEntry[];
  // Set (with entries: []) when the whole request is rejected outright, e.g. too large — a clear
  // error is better than silently truncating or serving a huge payload.
  error?: string;
}

type Segment = Amud["sections"][number];

function segmentEntry(segment: Segment): GetRefsResultEntry {
  return {
    ref: segment.ref,
    he: replaceBase64ImagesWithTempFileLocations(
      toFlatArray(segment.he).join(" "), {ref: segment.ref}),
    en: replaceBase64ImagesWithTempFileLocations(
      toFlatArray(segment.en).join(" "), {ref: segment.ref}),
  };
}

function adjacentPage(book: Book, page: string, direction: "previous" | "next"): string | undefined {
  try {
    const adjacent = direction === "previous" ? book.previousPage(page) : book.nextPage(page);
    return book.doesSectionExist(adjacent) ? adjacent : undefined;
  } catch {
    return undefined; // books without page navigation
  }
}

// e.g. "Sukkah 53b:7-9" or "Sukkah 53b:10-54a:2" — the shape Mesorat Hashas parallels use.
const RANGE_REF = /^(.+) (\d+[ab]):(\d+)-(?:(\d+[ab]):)?(\d+)$/;
const MAX_RANGE_PAGES = 3;

function segmentNumber(segmentRef: string): number {
  return parseInt(segmentRef.slice(segmentRef.lastIndexOf(":") + 1), 10);
}

type RangeSegments =
  | {segments: Segment[]; error?: undefined}
  | {segments?: undefined; error: string};

/** The base segments of a range ref, in order, walking forward across at most `maxPages` amudim. */
function rangeSegments(ref: string, maxPages: number): RangeSegments {
  const [, bookName, startPage, startSegment, endPageOrSame, endSegment] = RANGE_REF.exec(ref)!;
  const location = parseRefLocation(`${bookName} ${startPage}`);
  if (!location) return {error: "could not determine which book/page this ref belongs to"};
  const endPage = endPageOrSame ?? startPage;
  const segments: Segment[] = [];
  let page: string | undefined = startPage;
  for (let pagesRead = 0; page && pagesRead < maxPages; pagesRead++) {
    const amud = loadAmud(location.book, page);
    if (!amud) return {error: `${bookName} ${page} is not cached`};
    for (const segment of amud.sections) {
      const n = segmentNumber(segment.ref);
      if (page === startPage && n < parseInt(startSegment, 10)) continue;
      if (page === endPage && n > parseInt(endSegment, 10)) continue;
      segments.push(segment);
    }
    if (page === endPage) return {segments};
    page = adjacentPage(location.book, page, "next");
  }
  return {error: `range spans more than ${maxPages} pages, or its end isn't in the book`};
}

export type RefLang = "he" | "en" | "both";

function withLang(entry: GetRefsResultEntry, lang: RefLang): GetRefsResultEntry {
  if (lang === "he") return {ref: entry.ref, he: entry.he};
  if (lang === "en") return {ref: entry.ref, en: entry.en};
  return entry;
}

/** A segment range, returned as one entry whose text is the range's segments joined in order. */
function getRangeEntry(ref: string): GetRefsResultEntry {
  const {segments, error} = rangeSegments(ref, MAX_RANGE_PAGES);
  if (!segments) return {ref, error};
  const entries = segments.map(segmentEntry);
  return {ref, he: entries.map(e => e.he).join(" "), en: entries.map(e => e.en).join(" ")};
}

export function getRefs(refs: string[], lang: RefLang = "both"): GetRefsResult {
  if (refs.length > MAX_REFS_PER_CALL) {
    return {
      entries: [],
      error: `Requested ${refs.length} refs, over the ${MAX_REFS_PER_CALL}-ref limit per call. `
        + "Split this into multiple smaller calls.",
    };
  }
  const entries: GetRefsResultEntry[] = refs.map((ref): GetRefsResultEntry => {
    if (RANGE_REF.test(ref)) return getRangeEntry(ref);
    const location = parseRefLocation(ref);
    if (!location) {
      return {ref, error: "could not determine which book/page this ref belongs to"};
    }
    const entry = getPageIndex(location.book, location.page)?.get(ref);
    if (!entry) return {ref, error: "not found on the cached page"};
    return {ref, he: entry.he, en: entry.en};
  }).map(entry => (entry.error ? entry : withLang(entry, lang)));
  const totalChars = entries.reduce(
    (sum, e) => sum + (e.he?.length ?? 0) + (e.en?.length ?? 0), 0);
  if (totalChars > MAX_CHARS_PER_CALL) {
    return {
      entries: [],
      error: `Combined result is ${totalChars} characters, over the ${MAX_CHARS_PER_CALL}-`
        + "character limit per call. Request fewer refs at once"
        + (lang === "both" ? ", or pass --lang he if you only need the Hebrew wording" : "")
        + "."
        + (refs.some(ref => RANGE_REF.test(ref))
          ? " To find one spot in a long range, search the range instead, then get-refs only "
            + "the matching segment."
          : ""),
    };
  }
  return {entries};
}

export interface NeighborSegmentsResult {
  entries: GetRefsResultEntry[];
  error?: string;
}

function segmentsBeyondPage(
  book: Book, page: string, direction: "previous" | "next", count: number,
): Segment[] {
  const result: Segment[] = [];
  let current = page;
  while (result.length < count) {
    const adjacent = adjacentPage(book, current, direction);
    const adjacentAmud = adjacent && loadAmud(book, adjacent);
    if (!adjacent || !adjacentAmud) break;
    const remaining = count - result.length;
    const {sections} = adjacentAmud;
    if (direction === "previous") {
      result.unshift(...sections.slice(Math.max(0, sections.length - remaining)));
    } else {
      result.push(...sections.slice(0, remaining));
    }
    current = adjacent;
  }
  return result;
}

/**
 * Neighbors only make sense for base Gemara segments, not commentary comments. Crosses into the
 * previous/next amud when `before`/`after` runs past the edge of the page, so the caller never has
 * to guess how many segments the adjacent amud has in order to address its last few by ref.
 */
export function getNeighborSegments(
  ref: string, before = 1, after = 1,
): NeighborSegmentsResult {
  const location = parseRefLocation(ref);
  if (!location) {
    return {entries: [], error: "could not determine which book/page this ref belongs to"};
  }
  const {book} = location;
  const amud = loadAmud(book, location.page);
  if (!amud) return {entries: [], error: "page not cached"};
  const index = amud.sections.findIndex(segment => segment.ref === ref);
  if (index === -1) {
    return {
      entries: [],
      error: "ref is not a base Gemara segment on its page (neighbors only apply to segments, "
        + "not commentary comments — use get-refs for a specific comment)",
    };
  }
  const segments = amud.sections.slice(
    Math.max(0, index - before), Math.min(amud.sections.length, index + after + 1));

  segments.unshift(...segmentsBeyondPage(book, location.page, "previous", before - index));
  segments.push(...segmentsBeyondPage(
    book, location.page, "next", after - (amud.sections.length - index - 1)));
  return {entries: segments.map(segmentEntry)};
}

export interface BaseSegment extends GetRefsResultEntry {
  // Mesorat Hashas refs (often ranges like "Sukkah 53b:7-9") for passages parallel to this one.
  parallelRefs: string[];
}

/** The base Gemara segment a top-level commentary comment is attached to. */
export function findBaseSegment(commentRef: string): BaseSegment | undefined {
  const location = parseRefLocation(commentRef);
  if (!location) return undefined;
  const amud = loadAmud(location.book, location.page);
  const segment = amud?.sections.find(candidate => Object.values(candidate.commentary ?? {})
    .some(commentary => commentary.comments.some(comment => comment.ref === commentRef)));
  if (!segment) return undefined;
  const parallelRefs = (segment.commentary?.["Mesorat Hashas"]?.comments ?? [])
    .map(comment => comment.ref);
  return {...segmentEntry(segment), parallelRefs};
}

export const MAX_SEARCH_MATCHES = 15;
const MAX_SEARCH_RANGE_PAGES = 6;
const SEARCHED_COMMENTARIES = ["Rashi", "Tosafot"];
const SNIPPET_RADIUS = 40;

export interface SearchMatch {
  ref: string;
  snippet: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  truncated?: boolean;
  error?: string;
}

function plainText(text: string): string {
  return stripHebrewNonletters(text.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/**
 * Finds a word or phrase in one page or one segment range (e.g. a Mesorat Hashas parallel or a
 * sugya) — the Gemara segments plus their Rashi and Tosafot — ignoring vowels and punctuation.
 * Hebrew queries search Hebrew text; anything else searches English. Bounded to a page or a
 * short range so a search can't turn into a corpus-wide crawl.
 */
export function searchPage(pageOrRange: string, query: string): SearchResult {
  let segments: Segment[];
  if (RANGE_REF.test(pageOrRange)) {
    const range = rangeSegments(pageOrRange, MAX_SEARCH_RANGE_PAGES);
    if (!range.segments) return {matches: [], error: range.error};
    segments = range.segments;
  } else {
    const location = parseRefLocation(pageOrRange);
    if (!location) {
      return {matches: [], error: "could not determine which book/page this belongs to"};
    }
    const amud = loadAmud(location.book, location.page);
    if (!amud) return {matches: [], error: "page not cached"};
    segments = amud.sections;
  }
  const regex = hebrewSearchRegex(query.trim(), false);
  if (!regex || !query.trim()) return {matches: [], error: "invalid search query"};
  const field = /[א-ת]/.test(query) ? "he" : "en";

  const texts: {ref: string; text: string}[] = [];
  for (const segment of segments) {
    texts.push({ref: segment.ref, text: toFlatArray(segment[field]).join(" ")});
    for (const commentator of SEARCHED_COMMENTARIES) {
      for (const comment of segment.commentary?.[commentator]?.comments ?? []) {
        texts.push({ref: comment.ref, text: toFlatArray(comment[field]).join(" ")});
      }
    }
  }

  const matches: SearchMatch[] = [];
  for (const {ref, text} of texts) {
    const plain = plainText(text);
    regex.lastIndex = 0;
    const match = regex.exec(plain);
    if (!match) continue;
    if (matches.length === MAX_SEARCH_MATCHES) return {matches, truncated: true};
    const start = Math.max(0, match.index - SNIPPET_RADIUS);
    const end = Math.min(plain.length, match.index + match[0].length + SNIPPET_RADIUS);
    matches.push({
      ref,
      snippet: `${start > 0 ? "…" : ""}${plain.slice(start, end)}${end < plain.length ? "…" : ""}`,
    });
  }
  return {matches};
}

export interface SugyaRange {
  start: string;
  end: string;
  length: number;
}

function readSugyot(book: Book): SugyaRange[] {
  const filePath = `precomputed/sugyot/${book.canonicalName}.json`;
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(readUtf8(filePath)) as SugyaRange[];
}

/** "Arakhin 8b:17" + "Arakhin 10a:1" -> "Arakhin 8b:17-10a:1", usable by get-refs and search. */
function segmentRangeRef(start: string, end: string): string {
  const startPage = start.slice(0, start.lastIndexOf(":"));
  const endPage = end.slice(0, end.lastIndexOf(":"));
  const endSegment = end.slice(end.lastIndexOf(":") + 1);
  return startPage === endPage
    ? `${start}-${endSegment}`
    : `${start}-${endPage.slice(endPage.lastIndexOf(" ") + 1)}:${endSegment}`;
}

export interface PriorSugyaResult {
  sugyot: (SugyaRange & {range: string})[];
  error?: string;
}

/**
 * Metadata only (ref range + segment count), not full text — deliberately even more skeletal
 * than page_skeleton.ts, since this is for orientation ("how much prior discussion is there, and
 * where does it start") rather than reading it. Follow up with get-refs for any specific ref
 * this points at.
 */
export function getPriorSugyaSkeleton(ref: string, count = 2): PriorSugyaResult {
  const location = parseRefLocation(ref);
  if (!location) {
    return {sugyot: [], error: "could not determine which book/page this ref belongs to"};
  }
  const sugyot = readSugyot(location.book);
  if (sugyot.length === 0) return {sugyot: [], error: "no sugya data for this book"};
  const index = sugyot.findIndex(
    sugya => parseRefLocation(sugya.start)?.page === location!.page);
  if (index === -1) {
    return {sugyot: [], error: "could not find this page in the sugya index"};
  }
  return {
    sugyot: sugyot.slice(Math.max(0, index - count), index)
      .map(sugya => ({...sugya, range: segmentRangeRef(sugya.start, sugya.end)})),
  };
}

/**
 * Extracts which refs a generation call actually requested via context_fetch_cli, from the raw
 * Bash tool-use log a headless call returns (agent_runner.ts's `toolUses`). This is what makes
 * `dependsOn` auto-populated rather than self-reported — see rashi_tosafot_translation.ts.
 */
export function extractRequestedRefs(toolUses: ToolUseRecord[]): string[] {
  const refs = new Set<string>();
  for (const use of toolUses) {
    if (use.name !== "Bash" && use.name !== "run_command") continue;
    const input = use.input as {command?: string; CommandLine?: string} | undefined;
    const command = input?.command ?? input?.CommandLine;
    if (!command || !command.includes("context_fetch_cli")) continue;
    if (/context_fetch_cli\S*\s+(wikipedia|search)\b/.test(command)) continue;
    const arrayMatch = command.match(/\[[^\]]*]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0].replace(/'/g, "\"")) as string[];
        parsed.forEach(ref => refs.add(ref));
        continue;
      } catch {
        // Not a JSON array (e.g. get-neighbors/get-prior-sugyot take a single ref) — fall
        // through to the single-ref match below.
      }
    }
    const singleMatch = command.match(/["']([^"']+)["']/);
    if (singleMatch) refs.add(singleMatch[1]);
  }
  return Array.from(refs);
}

export interface WikipediaResult {
  title?: string;
  description?: string;
  extract?: string;
  url?: string;
  error?: string;
}

/**
 * Fetches summary text from Wikipedia for a given term or topic (e.g. realia, plants, animals,
 * historical figures, or French loanwords).
 */
export async function fetchWikipedia(
  query: string,
  lang = "en",
): Promise<WikipediaResult> {
  const cleanLang = /^[a-z]{2,3}$/.test(lang) ? lang : "en";
  const titleSlug = encodeURIComponent(query.trim().replace(/\s+/g, "_"));
  const url = `https://${cleanLang}.wikipedia.org/api/rest_v1/page/summary/${titleSlug}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "TalmudPageTranslationBot/1.0 (https://talmud.page)",
      },
    });
    if (!res.ok) {
      if (res.status === 404) {
        return {error: `Wikipedia article not found for "${query}" on ${cleanLang}.wikipedia.org`};
      }
      return {error: `Wikipedia API returned HTTP ${res.status}`};
    }
    /* eslint-disable camelcase */
    const data = await res.json() as {
      title?: string;
      description?: string;
      extract?: string;
      content_urls?: {desktop?: {page?: string}};
    };
    /* eslint-enable camelcase */
    return {
      title: data.title,
      description: data.description,
      extract: data.extract,
      url: data.content_urls?.desktop?.page,
    };
  } catch (e) {
    return {error: `Failed to fetch Wikipedia: ${(e as Error).message}`};
  }
}
