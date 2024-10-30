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

const NUMERIC_VALUES_TO_LETTER = Object.entries(LETTER_NUMERIC_VALUES).sort((a, b) => b[1] - a[1]);

export function numericLiteralAsInt(hebrew: string): number {
  return hebrew.split("").map(x => LETTER_NUMERIC_VALUES[x]!).reduce((x, y) => x + y);
}

export function intToHebrewNumeral(value: number): string {
  const chars: string[] = [];
  while (value > 0) {
    if (value === 15) {
      chars.push("טו");
      break;
    } else if (value === 16) {
      chars.push("טז");
      break;
    }
    for (const [numeral, numeralValue] of NUMERIC_VALUES_TO_LETTER) {
      if (value >= numeralValue) {
        value -= numeralValue;
        chars.push(numeral);
        break;
      }
    }
  }
  return chars.join("");
}

export const ALEPH = "א";
export const BET = "ב";
export const TAV = "ת";

// https://en.wikipedia.org/wiki/Hebrew_(Unicode_block)

const HEBREW_NON_LETTERS = "[֑-ׇ]";
const HEBREW_NON_LETTERS_REGEX = new RegExp(HEBREW_NON_LETTERS, "g");

/**
 * Removes all Hebrew-specific unicode characters that are not letters, i.e. vowels, trope
 */
export function stripHebrewNonletters(text: string): string {
  return text.replace(HEBREW_NON_LETTERS_REGEX, "");
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // eslint-disable-line unicorn/better-regex
}

export function hebrewSearchRegex(text: string, asRegex: boolean): RegExp | undefined {
  const escaped = asRegex ? text : escapeRegex(text);
  const regexText = stripHebrewNonletters(escaped).replace(
    /([א-ת])/g,
    (_, group) => group + HEBREW_NON_LETTERS + "*");
  try {
    return new RegExp(regexText, "gi");
  } catch {
    return undefined;
  }
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

export function stripTanakhGapIndicators(text: string): string {
  return text
    .replace(/\s?<span class="mam-spi-pe">{פ}<\/span>(<br ?\/?>)?/g, "")
    .replace(/\s?<span class="mam-spi-samekh">{ס}<\/span>\s*/g, "");
}
