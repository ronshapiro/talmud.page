import * as fs from "fs";
import {htmlEscape} from "./html_escape";
import {sendEmail} from "./mailjet";

const CORRECTIONS_EMAIL = "corrections@talmud.page";

// Latin letters with diacritics (excluding the multiplication and division signs), as well as
// Spanish inverted punctuation. These don't appear in normal English translations.
const NON_ENGLISH_LATIN = /[¡¿\u00C0-\u024F]/;

function hasNonEnglishLatin(text: string): boolean {
  return NON_ENGLISH_LATIN.test(text.replace(/[\u00D7\u00F7]/g, ""));
}

export interface OverflowFilterResult {
  english: string[];
  removed: string[];
}

/**
 * If there are more English segments than Hebrew segments, and every extra (trailing) English
 * segment contains non-English Latin characters, the extras are dropped.
 */
export function filterNonEnglishOverflow(
  hebrew: string[], english: string[],
): OverflowFilterResult {
  if (english.length <= hebrew.length) return {english, removed: []};
  const extras = english.slice(hebrew.length);
  if (!extras.every(hasNonEnglishLatin)) return {english, removed: []};
  return {english: english.slice(0, hebrew.length), removed: extras};
}

export type MismatchEmailKind = "otherLanguageOverflow" | "genericMismatch";

const alreadyReported: Record<MismatchEmailKind, Set<string>> = {
  otherLanguageOverflow: new Set(),
  genericMismatch: new Set(),
};

/** Visible for testing. */
export function resetReportedMismatches(): void {
  alreadyReported.otherLanguageOverflow.clear();
  alreadyReported.genericMismatch.clear();
}

export interface MismatchReport {
  kind: MismatchEmailKind;
  ref: string;
  hebrewLength: number;
  englishLength: number;
  extra: string[];
  /** Whether filtering resolved the length mismatch. */
  resolved: boolean;
}

/**
 * Emails corrections@talmud.page about a mismatch if a mailjet key is available. Each ref is only
 * reported once per kind per server runtime. Never throws.
 */
export function reportMismatch(report: MismatchReport): void {
  const {kind, ref} = report;
  if (!fs.existsSync("mailjet_api_key")) return;
  if (alreadyReported[kind].has(ref)) return;
  alreadyReported[kind].add(ref);

  const subject = kind === "otherLanguageOverflow"
    ? `Other-language translation overflow: ${ref}`
    : `Mismatched Hebrew/English lengths: ${ref}`;
  const summary = `Hebrew length: ${report.hebrewLength}, English length: ${report.englishLength}`
    + (kind === "otherLanguageOverflow"
      ? `. Filtering extra segments ${report.resolved ? "resolved" : "did not resolve"} the mismatch.`
      : ".");
  const url = `https://www.sefaria.org/${ref.replace(/ /g, "_")}`;
  const extraHeading = kind === "otherLanguageOverflow" ? "Removed segments" : "Unmatched segments";

  sendEmail({
    to: CORRECTIONS_EMAIL,
    subject,
    text: [`${ref} (${url})`, summary, extraHeading + ":", ...report.extra].join("\n\n"),
    html: [
      `<a href="${htmlEscape(url)}">${htmlEscape(ref)}</a>`,
      htmlEscape(summary),
      `<b>${extraHeading}:</b>`,
      ...report.extra.map(htmlEscape),
    ].join("<br><br>"),
  }).catch(e => console.error("Failed to send mismatch email", e));
}
