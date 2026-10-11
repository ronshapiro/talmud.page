import {refSorter} from "./js/google_drive/ref_sorter";
import {ListMultimap} from "./multimap";

function refSuffixIndex(reference: string): number {
  if (reference.includes("-")) {
    return -1;
  }
  return Math.max(reference.lastIndexOf(":"), reference.lastIndexOf(" "));
}

function splitOnRefSuffix(reference: string): string[] {
  const splitPoint = refSuffixIndex(reference);
  if (splitPoint === -1) {
    return [reference];
  }
  return [reference.substring(0, splitPoint), reference.substring(splitPoint + 1)];
}

export function mergeRefs(references: string[]): ListMultimap<string, string> {
  const uniqueReferences = Array.from(new Set(references));
  const unmerged: string[] = [];
  const bySharedPrefix = new ListMultimap<string, string>();
  for (const reference of uniqueReferences) {
    const pieces = splitOnRefSuffix(reference);
    if (pieces.length === 1) {
      unmerged.push(reference);
    } else {
      bySharedPrefix.put(pieces[0], reference);
    }
  }

  const mergedRefs = new ListMultimap<string, string>();
  for (const mergeableValues of Array.from(bySharedPrefix.asMap().values())) {
    if (mergeableValues.length === 1) {
      mergedRefs.put(mergeableValues[0], mergeableValues[0]);
    } else {
      mergeableValues.sort(refSorter);
      const [prefix, firstSuffix] = splitOnRefSuffix(mergeableValues[0]);
      const [, lastSuffix] = splitOnRefSuffix(mergeableValues.at(-1)!);
      const splitCharacter = mergeableValues[0].charAt(refSuffixIndex(mergeableValues[0]));
      mergedRefs.putAll(`${prefix}${splitCharacter}${firstSuffix}-${lastSuffix}`, mergeableValues);
    }
  }
  unmerged.forEach(unmergedReference => mergedRefs.put(unmergedReference, unmergedReference));
  return mergedRefs.sortedCopy(refSorter);
}
