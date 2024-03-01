import {intToHebrewNumeral, ALEPH, BET} from "./hebrew";
import {checkNotUndefined} from "./js/undefined";

const SUFFIX: Record<string, string> = {
  a: ALEPH,
  b: BET,
};

export function formatDafInHebrew(hebrewName: string, page: string): string {
  const dafNumber = intToHebrewNumeral(parseInt(page));
  const suffix = checkNotUndefined(SUFFIX[page.slice(-1)]);
  return `${hebrewName} ${dafNumber},${suffix}`;
}
