import {RashiTosafotHebrewOption} from "./settings";

export interface FormattedRashiTosafotHebrew {
  mainHebrew: string;
  explanations: string[];
}

/**
 * Extracts all `<span class="explanation">...</span>` elements from Hebrew markup,
 * returning the cleaned Hebrew text and an array of explanation strings.
 */
export function extractExplanations(hebrewHtml: string): {
  withoutExplanations: string;
  explanations: string[];
} {
  const explanations: string[] = [];
  const explanationRegex = /<span\s+class=["']explanation["']>([\S\s]*?)<\/span>/gi;
  let match: RegExpExecArray | null = explanationRegex.exec(hebrewHtml);
  while (match !== null) {
    const content = match[1].trim();
    if (content) {
      explanations.push(content);
    }
    match = explanationRegex.exec(hebrewHtml);
  }
  const withoutExplanations = hebrewHtml
    .replace(/<span\s+class=["']explanation["']>[\S\s]*?<\/span>/gi, "")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/\s+([!,.:;?])/g, "$1")
    .trim();
  return {withoutExplanations, explanations};
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
 * - "as-is": Displays the original Vilna Hebrew text if available, or strips added markup.
 * - "punctuated-only": Displays punctuated Hebrew without abbreviation expansion or inline notes.
 * - "punctuated-expanded": Displays punctuated Hebrew with abbreviations expanded.
 */
export function formatRashiTosafotHebrew(parameters: {
  rawHebrew: string;
  originalHebrew?: string;
  option: RashiTosafotHebrewOption;
}): FormattedRashiTosafotHebrew {
  const {rawHebrew, originalHebrew, option} = parameters;
  const {withoutExplanations, explanations} = extractExplanations(rawHebrew);

  if (option === "as-is") {
    if (originalHebrew) {
      return {
        mainHebrew: originalHebrew,
        explanations,
      };
    }
    const unexpanded = stripAbbreviationMarkup(withoutExplanations);
    const unpunctuated = stripAddedPunctuation(unexpanded);
    return {
      mainHebrew: unpunctuated,
      explanations,
    };
  }

  if (option === "punctuated-expanded") {
    return {
      mainHebrew: expandAbbreviations(withoutExplanations),
      explanations,
    };
  }

  // Default: "punctuated-only"
  return {
    mainHebrew: withoutExplanations,
    explanations,
  };
}
