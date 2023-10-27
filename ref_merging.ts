import {refSorter} from "./js/google_drive/ref_sorter";
import {ListMultimap} from "./multimap";

function refSuffixIndex(ref: string): number {
  if (ref.includes("-")) {
    return -1;
  }
  return Math.max(ref.lastIndexOf(":"), ref.lastIndexOf(" "));
}

function splitOnRefSuffix(ref: string): string[] {
  const splitPoint = refSuffixIndex(ref);
  if (splitPoint === -1) {
    return [ref];
  }
  return [ref.substring(0, splitPoint), ref.substring(splitPoint + 1)];
}

export function mergeRefs(refs: string[]): ListMultimap<string, string> {
  refs = Array.from(new Set(refs));
  const unmerged: string[] = [];
  const bySharedPrefix = new ListMultimap<string, string>();
  for (const ref of refs) {
    const pieces = splitOnRefSuffix(ref);
    if (pieces.length === 1) {
      unmerged.push(ref);
    } else {
      bySharedPrefix.put(pieces[0], ref);
    }
  }

  const mergedRefs = new ListMultimap<string, string>();
  for (const mergeableValues of Array.from(bySharedPrefix.asMap().values())) {
    if (mergeableValues.length === 1) {
      mergedRefs.put(mergeableValues[0], mergeableValues[0]);
    } else {
      mergeableValues.sort(refSorter);
      const [prefix, firstSuffix] = splitOnRefSuffix(mergeableValues[0]);
      const [, lastSuffix] = splitOnRefSuffix(mergeableValues.slice(-1)[0]);
      const splitChar = mergeableValues[0].charAt(refSuffixIndex(mergeableValues[0]));
      mergedRefs.putAll(`${prefix}${splitChar}${firstSuffix}-${lastSuffix}`, mergeableValues);
    }
  }
  unmerged.forEach(x => mergedRefs.put(x, x));
  return mergedRefs.sortedCopy();
}
