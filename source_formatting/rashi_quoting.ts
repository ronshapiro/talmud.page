const BEGINNING_WORDS = [
  "כך",
  "כ׳",
  "כ'",
  //
  "מה",
  //
  "כמו",
  //
  "שפירש",
  "שפ'",
  "שפי'",
  "כתב",
  "שכתב",
  "שכ'",
  "פירש",
  "פ'",
  "פי'",
  "כדפ'",
  "כדפי'",
  "כדפירש",
];

const END_WORDS = [
  "הקונטרס",
  "בקונטרס",
  "ובקונטרס פירש",
  "בקונט'",
  "הקונט'",
];


function wordGroup(forms: string[]) {
  return `(${forms.join("|")})`;
}

function optionalWordGroup(forms: string[]) {
  return `(${wordGroup(forms)}\\s)?`;
}

const REGEX = new RegExp(
  optionalWordGroup(BEGINNING_WORDS)
    + optionalWordGroup(BEGINNING_WORDS)
    + optionalWordGroup(BEGINNING_WORDS)
    + optionalWordGroup(BEGINNING_WORDS)
    + wordGroup(END_WORDS),
);

export function highlightRashiQuotations(
  text: sefaria.TextType,
): sefaria.TextType {
  if (Array.isArray(text)) {
    return text.map(x => highlightRashiQuotations(x)) as sefaria.TextType;
  }

  const pieces = [];
  let currentText = text;
  while (true) { // eslint-disable-line no-constant-condition
    const match = REGEX.exec(currentText);
    if (!match) {
      break;
    }
    pieces.push(
      currentText.substring(0, match.index),
      `<span class="rashi-quotation">${match[0]}</span>`,
    );
    currentText = currentText.substring(match.index + match[0].length);
  }
  pieces.push(currentText);

  return pieces.join("");
}
