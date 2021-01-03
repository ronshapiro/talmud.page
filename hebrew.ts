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

/**
 * Removes all Hebrew-specific unicode characters that are not letters, i.e. vowels, trope
 */
export function stripHebrewNonletters(text: string): string {
  return text.replace(/[֑-ׇ]/g, "");
}
