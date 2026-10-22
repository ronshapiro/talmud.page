import {RashiTosafotHebrewOption} from "./settings";


/**
 * Strips all `<span class="explanation">...</span>` elements from Hebrew markup,
 * returning the cleaned Hebrew text.
 */
export function stripExplanations(hebrewHtml: string): string {
  return hebrewHtml
    .replace(/<span\s+class=["']explanation["']>[\S\s]*?<\/span>/gi, "")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\s+([!,.:;?])/g, "$1")
    .trim();
}

/**
 * Replaces `<abbr title="expansion">abbreviation</abbr>` with the expanded text:
 * `<abbr title="abbreviation" class="expanded-abbr">expansion</abbr>`, allowing users to read
 * the expansion in-place while still inspecting the original abbreviation via tooltip.
 */
export function expandAbbreviations(hebrewHtml: string): string {
  return hebrewHtml.replace(
    /<abbr\s+title=["']([^"']*)["']>([\S\s]*?)<\/abbr>/gi,
    '<abbr title="$2" class="expanded-abbr">$1</abbr>',
  );
}

/**
 * Unwraps `<abbr title="expansion">abbreviation</abbr>` to the original abbreviation text.
 */
export function stripAbbreviationMarkup(hebrewHtml: string): string {
  return hebrewHtml.replace(/<abbr\s+title=["'][^"']*["']>([\S\s]*?)<\/abbr>/gi, "$1");
}

/**
 * Strips added punctuation (commas, semicolons, exclamation marks, question marks,
 * periods, hyphens) while preserving Hebrew letters, nikkud, gershayim, and dibur hamatchil.
 */
export function stripAddedPunctuation(hebrewHtml: string): string {
  return hebrewHtml
    .replace(/([!,.:;?–—-])/g, "")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}

/**
 * Formats Rashi/Tosafot Hebrew text according to user preference:
 * - "vilna": Displays the original Vilna Hebrew text if available, or strips added markup.
 * - "punctuated-only": Displays punctuated Hebrew without abbreviation expansion or inline notes.
 * - "punctuated-expanded": Displays punctuated Hebrew with abbreviations expanded.
 */
export function formatRashiTosafotHebrew(parameters: {
  rawHebrew: string;
  originalHebrew?: string;
  option: RashiTosafotHebrewOption;
}): string {
  const {rawHebrew, originalHebrew, option} = parameters;
  const withoutExplanations = stripExplanations(rawHebrew);

  if (option === "vilna") {
    if (originalHebrew) {
      return originalHebrew;
    }
    return stripAddedPunctuation(stripAbbreviationMarkup(withoutExplanations));
  }

  if (option === "punctuated-expanded") {
    return expandAbbreviations(withoutExplanations);
  }

  // Default: "punctuated-only"
  return withoutExplanations;
}
