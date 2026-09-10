import * as fs from "fs";
import {Amud, ApiComment} from "../apiTypes";
import {Book, books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {ToolUseRecord} from "../precomputed/rsi_state/context_usage_log";
import {toFlatArray} from "../sefariaTextType";

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
      he: toFlatArray(comment.he).join(" "),
      en: toFlatArray(comment.en).join(" "),
    });
    for (const commentary of Object.values(comment.commentary ?? {})) {
      for (const nested of commentary.comments) visitComment(nested);
    }
  };
  for (const segment of amud.sections) {
    index.set(segment.ref, {
      ref: segment.ref,
      he: toFlatArray(segment.he).join(" "),
      en: toFlatArray(segment.en).join(" "),
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

export function getRefs(refs: string[]): GetRefsResult {
  if (refs.length > MAX_REFS_PER_CALL) {
    return {
      entries: [],
      error: `Requested ${refs.length} refs, over the ${MAX_REFS_PER_CALL}-ref limit per call. `
        + "Split this into multiple smaller calls.",
    };
  }
  const entries: GetRefsResultEntry[] = refs.map(ref => {
    const location = parseRefLocation(ref);
    if (!location) {
      return {ref, error: "could not determine which book/page this ref belongs to"};
    }
    const entry = getPageIndex(location.book, location.page)?.get(ref);
    if (!entry) return {ref, error: "not found on the cached page"};
    return {ref, he: entry.he, en: entry.en};
  });
  const totalChars = entries.reduce(
    (sum, e) => sum + (e.he?.length ?? 0) + (e.en?.length ?? 0), 0);
  if (totalChars > MAX_CHARS_PER_CALL) {
    return {
      entries: [],
      error: `Combined result is ${totalChars} characters, over the ${MAX_CHARS_PER_CALL}-`
        + "character limit per call. Request fewer refs at once.",
    };
  }
  return {entries};
}

export interface NeighborSegmentsResult {
  entries: GetRefsResultEntry[];
  error?: string;
}

/** Neighbors only make sense for base Gemara segments, not commentary comments. */
export function getNeighborSegments(
  ref: string, before = 1, after = 1,
): NeighborSegmentsResult {
  const location = parseRefLocation(ref);
  if (!location) {
    return {entries: [], error: "could not determine which book/page this ref belongs to"};
  }
  const amud = loadAmud(location.book, location.page);
  if (!amud) return {entries: [], error: "page not cached"};
  const index = amud.sections.findIndex(segment => segment.ref === ref);
  if (index === -1) {
    return {
      entries: [],
      error: "ref is not a base Gemara segment on its page (neighbors only apply to segments, "
        + "not commentary comments — use get-refs for a specific comment)",
    };
  }
  const start = Math.max(0, index - before);
  const end = Math.min(amud.sections.length, index + after + 1);
  return {
    entries: amud.sections.slice(start, end).map(segment => ({
      ref: segment.ref,
      he: toFlatArray(segment.he).join(" "),
      en: toFlatArray(segment.en).join(" "),
    })),
  };
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

export interface PriorSugyaResult {
  sugyot: SugyaRange[];
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
  return {sugyot: sugyot.slice(Math.max(0, index - count), index)};
}

/**
 * Extracts which refs a generation call actually requested via context_fetch_cli, from the raw
 * Bash tool-use log a headless call returns (headless_claude.ts's `toolUses`). This is what makes
 * `dependsOn` auto-populated rather than self-reported — see rashi_tosafot_translation.ts.
 */
export function extractRequestedRefs(toolUses: ToolUseRecord[]): string[] {
  const refs = new Set<string>();
  for (const use of toolUses) {
    if (use.name !== "Bash" && use.name !== "run_command") continue;
    const input = use.input as {command?: string; CommandLine?: string} | undefined;
    const command = input?.command ?? input?.CommandLine;
    if (!command || !command.includes("context_fetch_cli")) continue;
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
