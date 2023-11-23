import {books} from "./books";

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
