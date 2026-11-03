// Data for the print layouts: fetched from Sefaria (or talmud.page's curated siddur handler),
// transformed with the same source_formatting building blocks as the web app, and cached on disk
// under cached_outputs/print so the offline PDF renderer can run without network access.

import * as fs from "fs";
import * as path from "path";
import {fetch} from "../../fetch";
import {
  MikraotChapter,
  MikraotComment,
  MikraotCommentary,
  SiddurSectionData,
  SiddurSegmentData,
} from "../model/dataTypes";
import {AvailableSource, tanakhBook} from "../model/mikraotCommentators";
import {siddurSection} from "../model/siddurEditions";

export const PRINT_CACHE_ROOT = path.join(__dirname, "..", "..", "cached_outputs", "print");

// Bump to invalidate processed (not raw) cache entries when transformations change.
const PROCESSING_VERSION = 6;

// When set, never touch the network; missing cache entries are errors.
let offline = false;
export function setOfflineMode(value: boolean): void {
  offline = value;
}

function safeFileName(name: string): string {
  return name.replace(/[^\w ',.-]/g, "_").replace(/ /g, "_");
}

function readJson<T>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJsonFile(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(value));
}

async function cached<T>(file: string, compute: () => Promise<T>): Promise<T> {
  const existing = readJson<T>(file);
  if (existing !== undefined) return existing;
  const value = await compute();
  writeJsonFile(file, value);
  return value;
}

// ---------------------------------------------------------------------------------------------
// Sefaria

interface SefariaV3Version {
  language: string;
  versionTitle: string;
  text: any;
}

interface SefariaV3Response {
  ref: string;
  heRef: string;
  versions: SefariaV3Version[];
  error?: string;
}

const FETCH_OPTIONS = {retry: {retries: 4, minTimeout: 200}, timeout: 60_000};

const inFlight = new Map<string, Promise<SefariaV3Response>>();

export function fetchSefariaText(ref: string, englishVersion?: string): Promise<SefariaV3Response> {
  const versionSuffix = englishVersion ? `@${englishVersion.slice(0, 60)}` : "";
  const file = path.join(PRINT_CACHE_ROOT, "sefaria", `${safeFileName(ref + versionSuffix)}.json`);
  const existing = readJson<SefariaV3Response>(file);
  if (existing) return Promise.resolve(existing);
  if (offline) return Promise.reject(new Error(`Offline and not cached: ${ref}`));
  const key = ref + versionSuffix;
  if (inFlight.has(key)) return inFlight.get(key)!;

  const english = englishVersion ? `english|${englishVersion}` : "english";
  const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref.replace(/ /g, "_"))}`
    + `?version=hebrew&version=${encodeURIComponent(english)}&return_format=strip_only_footnotes`;
  const promise = fetch(url, {retry: {retries: 4, minTimeout: 200}, timeout: 60_000})
    .then(x => x.json())
    .then((json: SefariaV3Response) => {
      if (json.error) throw new Error(`Sefaria error for ${ref}: ${json.error}`);
      writeJsonFile(file, json);
      return json;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

function version(response: SefariaV3Response, language: "he" | "en"): SefariaV3Version | undefined {
  return response.versions.find(x => x.language === language);
}

// ---------------------------------------------------------------------------------------------
// Text cleanup, using the web app's source_formatting pipeline. Loaded lazily because it pulls in
// JSDOM, which is slow to import.

// The markers come with spaces around them, often &nbsp; entities (a setuma's gap is a run of
// them), which go with them: the layout sets its own gap.
const SPACES = "(?:\\s|&nbsp;|&#160;)*";
const PEH_RE = new RegExp(`${SPACES}<span class="mam-spi-pe">{פ}</span>(<br\\s*/?>)?${SPACES}`, "g");
const SAMEKH_RE = new RegExp(`${SPACES}<span class="mam-spi-samekh">{ס}</span>${SPACES}`, "g");

function stripParashaMarkers(text: string): string {
  return text.replace(PEH_RE, " ").replace(SAMEKH_RE, " ").trim();
}

interface Formatters {
  hebrew(text: string, commentator?: string): string;
  english(text: string): string;
  verseHebrew(text: string): string;
}

let formattersPromise: Promise<Formatters> | undefined;

function formatters(): Promise<Formatters> {
  if (!formattersPromise) {
    formattersPromise = (async () => {
      const {HtmlNormalizer} = await import("../../source_formatting/html_normalizer");
      const {SefariaLinkSanitizer} = await import("../../source_formatting/sefaria_link_sanitizer");
      const {SectionSymbolRemover} = await import("../../source_formatting/section_symbol");
      const {boldDibureiHamatchil} = await import("../../source_formatting/dibur_hamatchil");
      const {CommentaryPrefixStripper} = await import("../../source_formatting/commentary_prefixes");
      const DOMPurify = await import("dompurify");
      const {JSDOM} = await import("jsdom");
      // @ts-ignore: the dompurify module is callable with a window
      const purify = (DOMPurify.default ?? DOMPurify)(new JSDOM("").window);
      const sanitizeHtml = (text: string): string => purify.sanitize(text, {
        ALLOWED_TAGS: ["b", "strong", "i", "em", "small", "big", "span", "br", "sup", "sub", "u"],
        ALLOWED_ATTR: ["class"],
      });

      const base = (text: string) => (
        HtmlNormalizer.process(SefariaLinkSanitizer.process(sanitizeHtml(text))));
      return {
        hebrew(text: string, commentator?: string) {
          let result = base(text);
          // Sefaria's Tanakh commentaries usually mark the dibbur hamatchil already; the heuristic
          // (bold up to the first dash) is only for texts that don't.
          const dash = result.search(/ [–-] /);
          if (commentator && !/<(b|strong)[\s>]/.test(result) && dash !== -1 && dash < 80) {
            result = boldDibureiHamatchil(result, commentator) as string;
          }
          if (commentator) {
            result = CommentaryPrefixStripper.process(result, commentator);
          }
          return result;
        },
        english(text: string) {
          return HtmlNormalizer.process(
            SectionSymbolRemover.process(SefariaLinkSanitizer.process(sanitizeHtml(text))));
        },
        verseHebrew(text: string) {
          return base(stripParashaMarkers(text));
        },
      };
    })();
  }
  return formattersPromise;
}

/** Petucha (פ) / setuma (ס) paragraph markers at the end of a verse. */
function parashaBreak(text: string): "peh" | "samekh" | undefined {
  if (/mam-spi-pe">{פ}/.test(text)) return "peh";
  if (/mam-spi-samekh">{ס}/.test(text)) return "samekh";
  return undefined;
}

/**
 * Koren's English starts some paragraphs with the Hebrew opening word as an anchor
 * ("בָּרוּךְ Blessed are You…"). Drop it when it's followed by English.
 */
function stripLeadingHebrew(html: string): string {
  return html.replace(/^((?:<[^>]+>)*)[ "'\u0590-\u05FF]+\s+(?=(?:<[^>]+>)*["(A-Z[a-z“])/, "$1");
}

function asStringArray(value: any): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  return (value as any[]).flatMap(x => asStringArray(x));
}

// ---------------------------------------------------------------------------------------------
// Mikraot Gedolot

/** The commentator's name for formatting heuristics, e.g. "Rashi" from "Rashi on Genesis ". */
function nameFromPrefix(refPrefix: string): string {
  return refPrefix.trim().split(/ on |,/)[0].trim();
}

/**
 * A commentary (or targum) chapter, fetched as `${refPrefix}${chapter}`. Texts with one string per
 * verse (targumim, Steinsaltz) become one comment per verse.
 */
export async function mikraotCommentary(
  refPrefix: string,
  chapter: number,
): Promise<MikraotCommentary> {
  const ref = `${refPrefix}${chapter}`;
  const file = path.join(PRINT_CACHE_ROOT, "mikraot", `v${PROCESSING_VERSION}`, `${safeFileName(ref)}.json`);
  return cached(file, async () => {
    const format = await formatters();
    const name = nameFromPrefix(refPrefix);
    let response: SefariaV3Response;
    try {
      response = await fetchSefariaText(ref);
    } catch (e: any) {
      return {id: refPrefix, verses: [], error: e.message ?? String(e)};
    }
    const he = version(response, "he");
    const en = version(response, "en");
    const heVerses: any[] = Array.isArray(he?.text) ? he!.text : [];
    const enVerses: any[] = Array.isArray(en?.text) ? en!.text : [];
    const flat = [...heVerses, ...enVerses].every(x => !Array.isArray(x));
    const verseCount = Math.max(heVerses.length, enVerses.length);
    const verses: MikraotComment[][] = [];
    for (let v = 0; v < verseCount; v++) {
      if (flat) {
        const heText = asStringArray(heVerses[v]).join(" ");
        const enText = asStringArray(enVerses[v]).join(" ");
        verses.push(heText.trim() || enText.trim() ? [{
          ref: `${ref}:${v + 1}`,
          he: format.verseHebrew(heText),
          en: format.english(enText),
        }] : []);
        continue;
      }
      const heComments = asStringArray(heVerses[v]);
      const enComments = asStringArray(enVerses[v]);
      const comments: MikraotComment[] = [];
      for (let c = 0; c < Math.max(heComments.length, enComments.length); c++) {
        const heText = heComments[c] ?? "";
        const enText = enComments[c] ?? "";
        if (!heText.trim() && !enText.trim()) continue;
        comments.push({
          ref: `${ref}:${v + 1}:${c + 1}`,
          he: heText ? format.hebrew(heText, name) : "",
          en: enText ? format.english(enText) : "",
        });
      }
      verses.push(comments);
    }
    return {id: refPrefix, verses, heVersion: he?.versionTitle, enVersion: en?.versionTitle};
  });
}

export async function mikraotChapter(
  book: string,
  chapter: number,
  refPrefixes: string[],
  translationVersion?: string,
): Promise<MikraotChapter> {
  const info = tanakhBook(book);
  if (!info) throw new Error(`Unknown Tanakh book: ${book}`);
  if (!(chapter >= 1 && chapter <= info.chapters)) throw new Error(`No chapter ${chapter} in ${book}`);

  const versionKey = translationVersion ? `.${safeFileName(translationVersion).slice(0, 60)}` : "";
  const file = path.join(
    PRINT_CACHE_ROOT, "mikraot", `v${PROCESSING_VERSION}`, `${safeFileName(book)}.${chapter}${versionKey}.text.json`);
  const base = await cached(file, async () => {
    const format = await formatters();
    const response = await fetchSefariaText(`${book} ${chapter}`, translationVersion);
    const he = asStringArray(version(response, "he")?.text);
    const en = asStringArray(version(response, "en")?.text);
    return {
      verses: he.map((x, i) => ({
        he: format.verseHebrew(x),
        en: format.english(en[i] ?? ""),
        breakAfter: parashaBreak(x),
      })),
      heVersion: version(response, "he")?.versionTitle ?? "",
      enVersion: version(response, "en")?.versionTitle ?? "",
    };
  });

  const commentaries: Record<string, MikraotCommentary> = {};
  await Promise.all(refPrefixes.map(async prefix => {
    commentaries[prefix] = await mikraotCommentary(prefix, chapter);
  }));

  return {book, bookHebrew: info.hebrewName, chapter, ...base, commentaries};
}

const LINKED_REF_RE = /^(.+?)(\d+):(\d+)(?::\d+)?(?:-[\d:]+)?$/;

/**
 * Commentaries and targumim that Sefaria links to a chapter and that are organized by chapter and
 * verse (so they can be fetched as `${refPrefix}${chapter}`), most-linked first.
 */
export async function mikraotSources(book: string, chapter: number): Promise<AvailableSource[]> {
  const file = path.join(PRINT_CACHE_ROOT, "mikraot", "sources", `${safeFileName(book)}.${chapter}.json`);
  return cached(file, async () => {
    if (offline) throw new Error(`Offline and not cached: sources for ${book} ${chapter}`);
    const url = `https://www.sefaria.org/api/links/${encodeURIComponent(`${book}.${chapter}`.replace(/ /g, "_"))}?with_text=0`;
    const links: any[] = await (await fetch(url, FETCH_OPTIONS)).json();
    const sources = new Map<string, AvailableSource>();
    for (const link of links) {
      if (link.category !== "Commentary" && link.category !== "Targum") continue;
      const match = String(link.ref ?? "").match(LINKED_REF_RE);
      if (!match || parseInt(match[2]) !== chapter) continue;
      // The commentary's verse must be the verse it's linked to (i.e. it is organized by verse).
      const anchorVerse = String(link.anchorRef ?? "").match(/:(\d+)/)?.[1];
      if (anchorVerse !== match[3]) continue;
      const refPrefix = match[1];
      const existing = sources.get(refPrefix);
      if (existing) {
        existing.count++;
      } else {
        sources.set(refPrefix, {
          refPrefix,
          englishName: link.collectiveTitle?.en ?? link.index_title ?? refPrefix,
          hebrewName: link.collectiveTitle?.he ?? "",
          category: link.category,
          count: 1,
        });
      }
    }
    // A single matching link is usually a coincidence of an unrelated structure.
    return Array.from(sources.values()).filter(x => x.count > 1).sort((a, b) => b.count - a.count);
  });
}

/** Checks that `${refPrefix}${chapter}` is a fetchable text, returning its names. */
export async function probeSource(refPrefix: string, chapter: number): Promise<AvailableSource> {
  const response = await fetchSefariaText(`${refPrefix}${chapter}`);
  const he = version(response, "he");
  const en = version(response, "en");
  if (!he && !en) throw new Error(`No text found for ${refPrefix}${chapter}`);
  return {
    refPrefix,
    englishName: nameFromPrefix(refPrefix),
    hebrewName: (response.heRef ?? "").replace(/\s+\S+$/, ""),
    category: "Commentary",
    count: 0,
  };
}

export interface TranslationVersion {
  versionTitle: string;
  label: string;
  language: string;
}

export async function translationVersions(book: string): Promise<TranslationVersion[]> {
  const file = path.join(PRINT_CACHE_ROOT, "mikraot", "versions", `${safeFileName(book)}.json`);
  return cached(file, async () => {
    if (offline) throw new Error(`Offline and not cached: versions of ${book}`);
    const url = `https://www.sefaria.org/api/texts/versions/${encodeURIComponent(book.replace(/ /g, "_"))}`;
    const versions: any[] = await (await fetch(url, FETCH_OPTIONS)).json();
    return versions
      .filter(x => x.language !== "he")
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map(x => ({
        versionTitle: x.versionTitle,
        label: x.shortVersionTitle || x.versionTitle,
        language: x.actualLanguage ?? x.language,
      }));
  });
}

// ---------------------------------------------------------------------------------------------
// Siddur

async function curatedSiddurPage(bookName: string, page: string): Promise<any> {
  // Reuse the web app's snapshot if one exists (cache_all_api_requests.ts writes these).
  const snapshot = path.join(
    __dirname, "..", "..", "cached_outputs", "api_request_handler", `${bookName}.${page}.json`);
  const existing = readJson<any>(snapshot);
  if (existing) return existing;
  if (offline) throw new Error(`Offline and not cached: ${bookName} ${page}`);

  const {ApiRequestHandler} = await import("../../api_request_handler");
  const {RealRequestMaker} = await import("../../request_makers");
  const response = await new ApiRequestHandler(new RealRequestMaker())
    .handleRequest(bookName, page);
  writeJsonFile(snapshot, response);
  return response;
}

type PrintCommentary = Record<string, {he: string; en: string}[]>;

function commentaryForPrint(commentary: any): PrintCommentary | undefined {
  if (!commentary) return undefined;
  const result: PrintCommentary = {};
  for (const [name, value] of Object.entries<any>(commentary)) {
    result[name] = (value.comments ?? []).map((x: any) => ({
      he: asStringArray(x.he).join("<br>"),
      en: asStringArray(x.en).join("<br>"),
    }));
  }
  return result;
}

export async function siddurSectionData(
  editionId: string,
  sectionId: string,
): Promise<SiddurSectionData> {
  const section = siddurSection(editionId, sectionId);
  const {source} = section;
  const file = path.join(
    PRINT_CACHE_ROOT, "siddur", `v${PROCESSING_VERSION}`, `${editionId}.${safeFileName(sectionId)}.json`);

  return cached(file, async () => {
    if (source.kind === "curated") {
      const response = await curatedSiddurPage(source.book, source.page);
      const segments: SiddurSegmentData[] = response.sections.map((x: any, i: number) => ({
        ref: x.ref,
        he: asStringArray(x.he).join(" "),
        en: asStringArray(x.en).join(" "),
        paragraphStart: (i === 0 || x.steinsaltz_start_of_sugya || x.startOfSection)
          ? true
          : undefined,
        commentary: commentaryForPrint(x.commentary),
      }));
      return {id: sectionId, title: section.title, titleHebrew: section.titleHebrew, segments};
    }

    const format = await formatters();
    const response = await fetchSefariaText(source.ref);
    const he = asStringArray(version(response, "he")?.text);
    const en = asStringArray(version(response, "en")?.text);
    const segments: SiddurSegmentData[] = [];
    for (let i = 0; i < Math.max(he.length, en.length); i++) {
      const english = format.english(en[i] ?? "");
      segments.push({
        ref: `${source.ref} ${i + 1}`,
        he: format.hebrew(he[i] ?? ""),
        en: source.stripEnglishLeadWords ? stripLeadingHebrew(english) : english,
        paragraphStart: true,
      });
    }

    // Commentaries whose segments align by index with this section's segments. Not every section
    // has commentary, so failed fetches are skipped.
    const commentaries = source.commentaries ?? [];
    const responses = await Promise.all(
      commentaries.map(x => fetchSefariaText(x.ref).catch(() => undefined)));
    commentaries.forEach((commentary, c) => {
      const commentaryResponse = responses[c];
      if (!commentaryResponse) return;
      const commentaryHe = asStringArray(version(commentaryResponse, "he")?.text);
      const commentaryEn = asStringArray(version(commentaryResponse, "en")?.text);
      segments.forEach((segment, i) => {
        const heText = commentaryHe[i]?.trim() ? format.hebrew(commentaryHe[i]) : "";
        const enText = commentaryEn[i]?.trim() ? format.english(commentaryEn[i]) : "";
        if (!heText && !enText) return;
        segment.commentary = {
          ...(segment.commentary ?? {}),
          [commentary.type]: [{he: heText, en: enText}],
        };
      });
    });
    return {id: sectionId, title: section.title, titleHebrew: section.titleHebrew, segments};
  });
}
