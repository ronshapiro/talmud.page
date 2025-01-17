import * as fs from "fs";
import {Amud, Section} from "../apiTypes";
import {books, Book} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {stripHebrewNonletters} from "../hebrew";
import {mishnaReferencePath} from "../precomputed";
import {sanitizeHtml} from "../source_formatting/html_sanitization_node";
import {writeJson} from "../util/json_files";

function canonicalizeToRefRange(ref: string): [[string, string], [string, string]] {
  if (ref.includes("-")) {
    const [start, end] = ref.split("-");
    const [startPage, startSegment] = start.split(":");
    const endParts = end.split(":");
    if (endParts.length === 1) {
      return [[startPage, startSegment], [startPage, endParts[0]]];
    } else {
      return [[startPage, startSegment], [endParts[0], endParts[1]]];
    }
  }
  const [page, segment] = ref.split(":");
  return [[page, segment], [page, segment]];
}

function mergeRefs(book: Book, first: string, second: string): string {
  if (first === second) return first;

  const bookPrefix = book.canonicalName + " ";
  first = first.replace(bookPrefix, "");
  second = second.replace(bookPrefix, "");

  const [startPage, startSegment] = canonicalizeToRefRange(first)[0];
  const [endPage, endSegment] = canonicalizeToRefRange(second)[1];

  if (startPage === endPage) {
    return `${bookPrefix}${startPage}:${startSegment}-${endSegment}`;
  } else {
    return `${bookPrefix}${startPage}:${startSegment}-${endPage}:${endSegment}`;
  }
}

function startsWithHeading(text: string, prefix: string): boolean {
  const stripped = stripHebrewNonletters(text);
  for (const beginning of ["", "<strong>", "<strong><big>", "<big>", "<big><strong>"]) {
    for (const chupchik of ["'", "׳"]) {
      if (stripped.startsWith(`${beginning}${prefix}${chupchik}`)) {
        return true;
      }
    }
  }
  return false;
}

function startsWithMatni(text: string): boolean {
  return startsWithHeading(text, "מתני");
}
function startsWithGemara(text: string): boolean {
  return startsWithHeading(text, "גמ");
}
const HEBREW_MISHNA_OR_GEMARA_START = (
  /^(<big><strong>|<strong><big>)(.*)(<\/strong><\/big>|<\/big><\/strong>).*$/);
function referencesMishna(text: string): boolean {
  text = sanitizeHtml(text);
  return (text.includes("שנינו במשנה")
    || text.includes("שנינו במשנתנו")
    || text.includes("במשנה שנינו")
    || text.includes("במשנה הובאה")
    || text.includes("נאמר במשנה"));
}

type StartKind = "mishna" | "gemara" | undefined;
function startKind(segment: Section): StartKind {
  if (segment.ref.endsWith(" 2a:1")) return "mishna";
  if (segment.ref === "Tamid 25b:1") return "mishna";
  if (typeof segment.he !== "string") return undefined;

  if (!segment.startOfSection) return undefined;
  if (startsWithMatni(segment.he)) return "mishna";

  const match = segment.he.match(HEBREW_MISHNA_OR_GEMARA_START);
  if (!match) return undefined;
  return startsWithGemara(match[2]) ? "gemara" : "mishna";
}

const REFS_WITHOUT_STEINSALTZ_BECAUSE_THEYRE_JUST_SIMANIM = new Set([
  "Shevuot 30b:12",
  "Zevachim 5b:7",
  "Zevachim 7b:8",
  "Zevachim 8b:4",
  "Zevachim 16b:18",
  "Zevachim 49b:14",
]);

function isMissingSteinsaltz(segment: Section) {
  if (REFS_WITHOUT_STEINSALTZ_BECAUSE_THEYRE_JUST_SIMANIM.has(segment.ref)) return false;
  if (segment.ref === "synthetic") return false;
  if (segment.hadran || segment.ref.startsWith("Hadran ")) return false;

  if (!segment.commentary) return true;
  return !("Steinsaltz" in segment.commentary);
}

for (const book of books.allBooks) {
  if (!book.isTalmud()) continue;
  if (book.canonicalName === "Shekalim") continue;

  const sugyaEndpoints: any[] = [];
  const perekEndpoints = [];
  const refPointers: any = {};
  const refPointersToSerialize: any = {};
  const mishnaReferences: Record<string, Record<string, string>> = {};

  let perekStart: string | undefined;
  let refsInSugya: string[] = [];
  let lastMishna: string | undefined;
  let lastMishnaEnd: string | undefined;
  let debugSegment: string | undefined;

  const saveSugya = () => {
    if (refsInSugya.length > 0) {
      const start = refsInSugya[0];
      const end = refsInSugya.at(-1)!;
      sugyaEndpoints.push({start, end, length: refsInSugya.length});

      for (const ref of refsInSugya) {
        const sugyaRef = mergeRefs(book, start, end);
        refPointers[ref] = sugyaRef;
        if (refsInSugya.length > 1) {
          refPointersToSerialize[ref] = sugyaRef;
        }
      }
    } else {
      throw new Error(debugSegment);
    }
  };

  let lastStartKind: StartKind;
  for (const section of book.sections) {
    const result = JSON.parse(
      fs.readFileSync(cachedOutputFilePath(book, section), {encoding: "utf-8"})) as Amud;

    for (const segment of result.sections) {
      debugSegment = segment.ref;
      if (segment.steinsaltz_start_of_sugya) segment.startOfSection = true;
      const isHadranEndOfMasechet = segment.ref === "Hadran 1";
      if (isMissingSteinsaltz(segment)) {
        throw new Error([
          `Steinsaltz not found in ${segment.ref}. This is likely a sign of an error during the `,
          "caching process. Try deleting the cached file and rerunning.",
        ].join());
      }
      const isFirstRefOfMasechet = segment.ref.endsWith(" 2a:1") || segment.ref === "Tamid 25b:1";
      if ((segment.startOfSection && !isFirstRefOfMasechet) || isHadranEndOfMasechet) {
        saveSugya();
        refsInSugya = [];
      }
      if (isHadranEndOfMasechet) {
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

    for (const segment of result.sections) {
      const currentStartKind = startKind(segment);
      if (currentStartKind === "mishna") {
        if (lastStartKind === "mishna") {
          lastMishnaEnd = segment.ref;
        } else {
          lastMishna = segment.ref;
          lastMishnaEnd = undefined;
        }
      } else if (!currentStartKind && segment.startOfSection && lastStartKind === "mishna") {
        lastMishnaEnd = segment.ref;
      }
      lastStartKind = currentStartKind ?? lastStartKind;

      if (segment.startOfSection
        && lastStartKind === "gemara"
        && referencesMishna(segment.commentary!.Steinsaltz.comments[0].he as string)) {
        const pointerStart = refPointers[lastMishna!] ?? lastMishna;
        const pointerEnd = lastMishnaEnd ? refPointers[lastMishnaEnd] : undefined;
        if (lastMishnaEnd && !pointerEnd) {
          throw new Error([lastMishnaEnd, pointerEnd, pointerStart, lastMishna].join(" - "));
        }
        const pointer = lastMishnaEnd ? mergeRefs(book, pointerStart, pointerEnd!) : pointerStart;
        if (pointer === undefined) {
          throw new Error([segment.ref, lastMishna + ""].join(" "));
        }
        // Don't bother adding a reference if we're on the same amud, otherwise we're linking
        // pretty much to ourselves!
        if (segment.ref.split(":")[0] !== pointer.split(":")[0]) {
          if (!mishnaReferences[result.id]) {
            mishnaReferences[result.id] = {};
          }
          mishnaReferences[result.id][segment.ref] = pointer;
        }
      }
    }
  }

  writeJson(`precomputed/sugyot/${book.canonicalName}.json`, sugyaEndpoints);
  writeJson(
    `precomputed/sugyot/pointers/${book.canonicalName}-pointers.json`, refPointersToSerialize);
  writeJson(`precomputed/masechet_prakim/${book.canonicalName}.json`, perekEndpoints);
  writeJson(mishnaReferencePath(book), mishnaReferences);
}
