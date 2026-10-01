// Fonts available to print documents. The @font-face rules live in print/print.css.

export interface PrintFont {
  id: string;
  label: string;
  family: string;
  script: "hebrew" | "latin";
  // Suitable for Rashi-script commentary.
  rashi?: true;
}

export const PRINT_FONTS: PrintFont[] = [
  {id: "frank-ruehl-clm", label: "Frank Ruehl CLM", family: "Frank Ruehl CLM", script: "hebrew"},
  {id: "keter-yg", label: "Keter YG", family: "Keter YG", script: "hebrew"},
  {id: "frank-ruhl-libre", label: "Frank Ruhl Libre", family: "Frank Ruhl Libre", script: "hebrew"},
  {id: "noto-serif-hebrew", label: "Noto Serif Hebrew", family: "Noto Serif Hebrew", script: "hebrew"},
  {id: "david-libre", label: "David Libre", family: "David Libre", script: "hebrew"},
  {id: "taamey-david", label: "Taamey David CLM", family: "Taamey David CLM", script: "hebrew"},
  {id: "noto-rashi", label: "Noto Rashi Hebrew (Rashi script)", family: "Noto Rashi Hebrew", script: "hebrew", rashi: true},
  {id: "noto-sans-hebrew", label: "Noto Sans Hebrew", family: "Noto Sans Hebrew", script: "hebrew"},
  {id: "eb-garamond", label: "EB Garamond", family: "EB Garamond", script: "latin"},
];

export function fontFamily(id: string): string {
  const font = PRINT_FONTS.find(x => x.id === id) ?? PRINT_FONTS[0];
  const fallback = font.script === "hebrew" ? '"Frank Ruehl CLM", serif' : "Georgia, serif";
  return `"${font.family}", ${fallback}`;
}

export function fontsForScript(script: "hebrew" | "latin"): PrintFont[] {
  return PRINT_FONTS.filter(x => x.script === script);
}

/** A Latin font followed by a Hebrew font, for English text that quotes Hebrew. */
export function mixedFontFamily(latinId: string, hebrewId: string): string {
  const latin = PRINT_FONTS.find(x => x.id === latinId) ?? PRINT_FONTS.find(x => x.script === "latin")!;
  const hebrew = PRINT_FONTS.find(x => x.id === hebrewId) ?? PRINT_FONTS[0];
  return `"${latin.family}", "${hebrew.family}", serif`;
}
