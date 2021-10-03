const LETTER_NUMERIC_VALUES: Record<string, number> = {
  א: 1,
  ב: 2,
  ג: 3,
  ד: 4,
  ה: 5,
  ו: 6,
  ז: 7,
  ח: 8,
  ט: 9,
  י: 10,
  כ: 20,
  ל: 30,
  מ: 40,
  נ: 50,
  ס: 60,
  ע: 70,
  פ: 80,
  צ: 90,
  ק: 100,
  ר: 200,
  ש: 300,
  ת: 400,
};

export function numericLiteralAsInt(hebrew: string): number {
  return hebrew.split("").map(x => LETTER_NUMERIC_VALUES[x]!).reduce((x, y) => x + y);
}

// https://en.wikipedia.org/wiki/Hebrew_(Unicode_block)

/**
 * Removes all Hebrew-specific unicode characters that are not letters, i.e. vowels, trope
 */
export function stripHebrewNonletters(text: string): string {
  return text.replace(/[֑-ׇ]/g, "");
}

const FIRST_TROPE = String.fromCharCode(0x0591);
const LAST_TROPE = String.fromCharCode(0x05AF);
const PASEQ = String.fromCharCode(0x05C0);
const THIN_SPACE = new RegExp(String.fromCharCode(0x2009), "g");

export function stripHebrewNonlettersOrVowels(text: string): string {
  return (
    text
      .replace(new RegExp(`[${FIRST_TROPE}-${LAST_TROPE}${PASEQ}]`, "g"), "")
      .replace(THIN_SPACE, " ")
      .replace(/<small><\/small>/g, "") // sometimes the after-effect of replacing a paseq
  );
}
