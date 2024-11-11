import {zip} from "underscore";
import {books} from "./books";
import {ListMultimap} from "./multimap";
import {stripHebrewNonletters} from "./hebrew";
import {Logger} from "./logger";

/* eslint-disable quote-props */
const STEINSALTZ_MASECHET_NUMBER = {
  "Arachin": 45,
  "Avodah Zarah": 38,
  "Bava Batra": 33,
  "Bava Kamma": 31,
  "Bava Metzia": 32,
  "Beitza": 19,
  "Bekhorot": 44,
  "Berakhot": 1,
  "Chagigah": 23,
  "Chullin": 43,
  "Eiruvin": 13,
  "Gittin": 29,
  "Horayot": 40,
  "Keritot": 47,
  "Ketubot": 25,
  "Kiddushin": 30,
  "Kinnim": 51,
  "Makkot": 35,
  "Me'ilah": 48,
  "Megillah": 21,
  "Menachot": 42,
  "Middot": 50,
  "Mo'ed Katan": 22,
  "Nazir": 27,
  "Nedarim": 26,
  "Niddah": 58,
  "Pesachim": 14,
  "Rosh Hashanah": 16,
  "Sanhedrin": 34,
  "Shabbat": 12,
  "Shekalim": 15,
  "Shevu'ot": 36,
  "Sotah": 28,
  "Sukkah": 18,
  "Ta'anit": 20,
  "Tamid": 49,
  "Temurah": 46,
  "Yevamot": 24,
  "Yoma": 17,
  "Zevahim": 41,
} as any;

for (const [steinsaltz, sefaria] of Object.entries({
  "Arachin": "Arakhin",
  "Beitza": "Beitzah",
  "Eiruvin": "Eruvin",
  "Me'ilah": "Meilah",
  "Mo'ed Katan": "Moed Katan",
  "Shevu'ot": "Shevuot",
  "Ta'anit": "Taanit",
  "Zevahim": "Zevachim",
})) {
  STEINSALTZ_MASECHET_NUMBER[sefaria] = STEINSALTZ_MASECHET_NUMBER[steinsaltz];
}

export function steinsaltzApiUrl(masechet: string, daf: string): string {
  const book = books.byCanonicalName[masechet];
  const masechetIndex = STEINSALTZ_MASECHET_NUMBER[book.canonicalName];
  if (masechetIndex === undefined) {
    throw new Error(`${masechet} does not have a masechet number!`);
  }
  return (
    `https://api.steinsaltz.dev/v1/library/talmud?`
    + `book=${masechetIndex}&page=2&masechta=${masechetIndex}&daf=${daf}`
  );
}

export function steinsaltzImageUrl(id: string, filename: string): string {
  return `https://api.steinsaltz.dev/v1/files/image/${id}/${filename}?preview=false`;
}

interface File {
  id: number;
  type: string;
  filename: string;
  size: number;
  captionEng: string | null;
  captionHeb: string | null;
}

interface Note {
  text: string;
  paired: boolean;
  files: File[];
}

interface EnglishNote extends Note {
  titleEng: string;
  titleHeb: string;
}
interface HebrewNote extends Note {
  title: string;
  type: {id: number, name: string};
}

export function getTextWithImages(note: Note | undefined, logger: Logger): string {
  if (!note) return "";

  const text = [];
  for (const file of note.files) {
    if (file.type !== "image") {
      logger.error(file);
      continue;
    }
    const caption = file.captionHeb ?? file.captionEng;
    text.push(
      `<img src="/stimg/${file.id}/${file.filename}" alt="${caption}" /><br />`);
  }
  text.push(note.text);

  return text.join("");
}

export function filterDuplicateImages(
  hebrew: HebrewNote | undefined, english: EnglishNote | undefined): void {
  if (!hebrew || !english) return;
  english.files = english.files.filter(englishFile => {
    for (const hebrewFile of hebrew.files) {
      if (englishFile.id === hebrewFile.id
        && englishFile.filename === hebrewFile.filename) {
        return false;
      }
    }
    return true;
  });
}

type HebrewEnglishPair = [HebrewNote | undefined, EnglishNote | undefined];

function splitFilter<T>(array: T[], filter: (t: T) => boolean): [T[], T[]] {
  const positive: T[] = [];
  const negative: T[] = [];
  for (const t of array) {
    (filter(t) ? positive : negative).push(t);
  }
  return [positive, negative];
}

function heuristicTiebraking(
  hebrewNotes: HebrewNote[], englishNotes: EnglishNote[],
): HebrewEnglishPair[] {
  const [hebrewHalacha, hebrewNonHalacha] = splitFilter(hebrewNotes, x => x.type.id === 8);
  const [englishHalacha, englishNonHalacha] = splitFilter(
    englishNotes, x => x.text.includes("(Rambam") || x.text.includes("Shulĥan Arukh"));
  for (const array of [hebrewHalacha, hebrewNonHalacha, englishHalacha, englishNonHalacha]) {
    array.sort((a, b) => a.text.length - b.text.length);
  }
  return [
    ...zip(hebrewNonHalacha, englishNonHalacha),
    ...zip(hebrewHalacha, englishHalacha),
  ] as HebrewEnglishPair[];
}

function normalizeHebrewTitle(value: string): string {
  return stripHebrewNonletters(value)
    .replace(/״/g, '"')
    .replace(/׳/g, "'")
    .replace(/,/g, "")
    .replace(/ וכו'$/, "");
}

function pairUnpaired(pairs: HebrewEnglishPair[]): HebrewEnglishPair[] {
  const [result, unpaired] = splitFilter(pairs, x => x[0] !== undefined && x[1] !== undefined);
  for (const x of unpaired) {
    for (const y of unpaired) {
      const hebrew = x[0] || y[0];
      const english = x[1] || y[1];
      if (hebrew === undefined || english === undefined) continue;
      if (hebrew.paired || english.paired) continue;
      const hebrewKey = normalizeHebrewTitle(hebrew.title);
      const englishKey = normalizeHebrewTitle(english.titleHeb);
      if (hebrewKey.includes(englishKey) || englishKey.includes(hebrewKey)) {
        hebrew.paired = true;
        english.paired = true;
        result.push([hebrew, english]);
      }
    }
  }

  for (const [hebrew, english] of unpaired) {
    if (hebrew?.paired || english?.paired) continue;
    result.push([hebrew, english]);
  }
  return result;
}

export function makeSteinsaltzCommentPairings(
  hebrewNotes: HebrewNote[], englishNotes: EnglishNote[],
): HebrewEnglishPair[] {
  const hebrewByNormalizedHebrewTitle = new ListMultimap<string, HebrewNote>();
  const englishByNormalizedHebrewTitle = new ListMultimap<string, EnglishNote>();
  for (const note of hebrewNotes) {
    hebrewByNormalizedHebrewTitle.put(normalizeHebrewTitle(note.title), note);
  }
  for (const note of englishNotes) {
    englishByNormalizedHebrewTitle.put(normalizeHebrewTitle(note.titleHeb), note);
  }

  const result: HebrewEnglishPair[] = [];
  for (const [key, groupedHebrewNotes] of hebrewByNormalizedHebrewTitle.asMap().entries()) {
    const groupedEnglishNotes = englishByNormalizedHebrewTitle.get(key);
    if (groupedHebrewNotes.length > 1 || groupedEnglishNotes.length > 1) {
      result.push(...heuristicTiebraking(groupedHebrewNotes, groupedEnglishNotes));
    } else {
      result.push(...(zip(groupedHebrewNotes, groupedEnglishNotes) as HebrewEnglishPair[]));
    }
  }
  for (const [key, groupedEnglishNotes] of englishByNormalizedHebrewTitle.asMap().entries()) {
    if (!hebrewByNormalizedHebrewTitle.asMap().has(key)) {
      result.push(...(zip([], groupedEnglishNotes) as HebrewEnglishPair[]));
    }
  }
  return pairUnpaired(result);
}
