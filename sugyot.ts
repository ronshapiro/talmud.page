import * as fs from "fs";
import {Amud, Section} from "./apiTypes";
import {books, Book} from "./books";
import {cachedOutputFilePath} from "./cached_outputs";
import {stripHebrewNonletters} from "./hebrew";
import {mishnaReferencePath} from "./precomputed";
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

function startsWithMatni(text: string): boolean {
  return stripHebrewNonletters(text).startsWith("מתני׳");
}

function doesntStartWithGemara(text: string): boolean {
  return !stripHebrewNonletters(text).startsWith("גמ׳");
}

const HEBREW_MISHNA_OR_GEMARA_START = (
  /^(<big><strong>|<strong><big>)(.*)(<\/strong><\/big>|<\/big><\/strong>).*$/);
function referencesMishna(text: string): boolean {
  return (text.includes("שנינו במשנה")
    || text.includes("שנינו במשנתנו")
    || text.includes("נאמר במשנה"));
}

function isMishna(segment: Section): boolean {
  if (segment.ref.endsWith(" 2a:1")) return true;
  if (!segment.steinsaltz_start_of_sugya) return false;
  if (typeof segment.he !== "string") return false;
  if (startsWithMatni(segment.he)) return true;

  const match = segment.he.match(HEBREW_MISHNA_OR_GEMARA_START);
  if (!match) return false;
  return startsWithMatni(match[2]) || doesntStartWithGemara(match[2]);
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

for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  if (!book.isMasechet()) continue;
  if (book.canonicalName === "Shekalim") continue;

  const sugyaEndpoints: any[] = [];
  const perekEndpoints = [];
  const refPointers: any = {};
  const mishnaReferences: Record<string, Record<string, string>> = {};

  let perekStart: string | undefined;
  let refsInSugya: string[] = [];
  let lastMishna: string | undefined;

  const saveSugya = () => {
    if (refsInSugya.length > 0) {
      const start = refsInSugya[0];
      const end = refsInSugya.at(-1)!;
      sugyaEndpoints.push({start, end, length: refsInSugya.length});

      for (const ref of refsInSugya) {
        const sugyaRef = mergeRefs(book, start, end);
        if (refsInSugya.length > 1) {
          refPointers[ref] = sugyaRef;
        }
      }
    }
  };

  for (const section of Array.from(book.sections)) {
    const result = JSON.parse(
      fs.readFileSync(cachedOutputFilePath(book, section), {encoding: "utf-8"})) as Amud;

    for (const segment of result.sections) {
      const isHadranEndOfMasechet = segment.ref === "Hadran 1";
      if (isMissingSteinsaltz(segment)) {
        throw new Error([
          `Steinsaltz not found in ${segment.ref}. This is likely a sign of an error during the `,
          "caching process. Try deleting the cached file and rerunning.",
        ].join());
      }
      if (segment.steinsaltz_start_of_sugya || isHadranEndOfMasechet) {
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
      if (isMishna(segment)) {
        lastMishna = segment.ref;
      } else if (segment.steinsaltz_start_of_sugya
        && referencesMishna(segment.commentary!.Steinsaltz.comments[0].he as string)) {
        const pointer = refPointers[lastMishna!] ?? lastMishna;
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

  writeJson(`sugyot/${book.canonicalName}.json`, sugyaEndpoints);
  writeJson(`sugya_pointers/${book.canonicalName}-pointers.json`, refPointers);
  writeJson(`masechet_prakim/${book.canonicalName}.json`, perekEndpoints);
  writeJson(mishnaReferencePath(book), mishnaReferences);
}
