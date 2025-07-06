import {intToHebrewNumeral, ALEPH, BET} from "./hebrew";
import {checkNotUndefined} from "./js/undefined";

const SUFFIX: Record<string, string> = {
  a: ALEPH,
  b: BET,
};
const DELIMITTER = ",";

export function formatDafInHebrew(hebrewName: string, page: string): string {
  const dafNumber = intToHebrewNumeral(parseInt(page));
  const suffix = checkNotUndefined(SUFFIX[page.slice(-1)]);
  return `${hebrewName} ${dafNumber}${DELIMITTER}${suffix}`;
}

export function makeAmudSmall(dafString: string): string {
  const [prefix, amud] = dafString.split(DELIMITTER);
  return [prefix, `<sub>ע"${amud}</sub>`].join("");
}
