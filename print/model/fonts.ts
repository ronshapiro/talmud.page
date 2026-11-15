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
  {id: "ezra-sil", label: "Ezra SIL (Biblical Hebrew)", family: "Ezra SIL", script: "hebrew"},
  {id: "cardo-hebrew", label: "Cardo", family: "Cardo", script: "hebrew"},
  {id: "shofar", label: "Shofar (Culmus)", family: "Shofar", script: "hebrew"},
  {id: "hadasim", label: "Hadasim CLM", family: "Hadasim CLM", script: "hebrew"},
  {id: "miriam-libre", label: "Miriam Libre", family: "Miriam Libre", script: "hebrew"},
  {id: "bellefair", label: "Bellefair", family: "Bellefair", script: "hebrew"},
  {id: "alef", label: "Alef (sans)", family: "Alef", script: "hebrew"},
  {id: "assistant", label: "Assistant (sans)", family: "Assistant", script: "hebrew"},
  {id: "heebo", label: "Heebo (sans)", family: "Heebo", script: "hebrew"},
  {id: "secular-one", label: "Secular One (display)", family: "Secular One", script: "hebrew"},
  {id: "suez-one", label: "Suez One (display)", family: "Suez One", script: "hebrew"},
  {id: "eb-garamond", label: "EB Garamond", family: "EB Garamond", script: "latin"},
  {id: "cardo", label: "Cardo", family: "Cardo", script: "latin"},
  {id: "crimson-pro", label: "Crimson Pro", family: "Crimson Pro", script: "latin"},
  {id: "libre-baskerville", label: "Libre Baskerville", family: "Libre Baskerville", script: "latin"},
  {id: "libre-caslon", label: "Libre Caslon Text", family: "Libre Caslon Text", script: "latin"},
  {id: "lora", label: "Lora", family: "Lora", script: "latin"},
  {id: "source-serif", label: "Source Serif 4", family: "Source Serif 4", script: "latin"},
  {id: "spectral", label: "Spectral", family: "Spectral", script: "latin"},
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
