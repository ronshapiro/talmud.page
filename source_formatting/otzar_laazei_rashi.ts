const REGEX = new RegExp([
  `\\d+ / \\(.*\\) / <b>(.*)</b></?br>(.*) / `,
  `(.*) / `,
  `<b>(.*)</b></?br>`,
  `(.*)`,
].join(""));

const ENGLISH_SUFFIX_TRANSLATION = /<span dir="ltr">(✭ )?(.*)<\/span>/;

export function parseOtzarLaazeiRashi(text: string): [string, string] {
  const match = text.match(REGEX);
  if (!match) {
    return [text, ""];
  }
  const [, diburHamatchil, laazHebrew, laazLatin, hebrewTranslation, suffix] = match;
  const hebrewLine = `<b>ד"ה ${diburHamatchil}</b> - ${laazHebrew}: ${hebrewTranslation}`;

  const suffixMatch = suffix.match(ENGLISH_SUFFIX_TRANSLATION);
  if (suffixMatch) {
    const englishTranslation = suffixMatch[2];
    return [hebrewLine, `${laazLatin} - ${englishTranslation}`];
  } else {
    return [`${hebrewLine}<br>${suffix}`, `${laazLatin}`];
  }
}
