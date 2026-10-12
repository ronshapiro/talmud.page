import {nextAmud} from "./books";
import {refSorter} from "./js/google_drive/ref_sorter";
import {ListMultimap} from "./multimap";

interface MergeOptions {
  requireContiguity?: boolean;
}

function isContiguousSuffix(
  previousSuffix: string,
  currentSuffix: string,
  options?: MergeOptions,
): boolean {
  if (/^\d+[ab]$/.test(previousSuffix) && /^\d+[ab]$/.test(currentSuffix)) {
    return currentSuffix === nextAmud(previousSuffix);
  }
  if (/^\d+$/.test(previousSuffix) && /^\d+$/.test(currentSuffix)) {
    if (options?.requireContiguity) {
      return parseInt(currentSuffix, 10) === parseInt(previousSuffix, 10) + 1;
    }
    return true;
  }
  return false;
}

function refSuffixIndex(ref: string): number {
  if (ref.includes("-")) {
    return -1;
  }
  const splitPoint = Math.max(ref.lastIndexOf(":"), ref.lastIndexOf(" "));
  if (splitPoint !== -1) {
    return splitPoint;
  }
  if (/^\d+[ab]$/.test(ref) || /^\d+$/.test(ref)) {
    return 0;
  }
  return -1;
}

function splitOnRefSuffix(ref: string): [string, string] | [string] {
  const splitPoint = refSuffixIndex(ref);
  if (splitPoint === -1) {
    return [ref];
  }
  if (splitPoint === 0) {
    return ["", ref];
  }
  return [ref.substring(0, splitPoint), ref.substring(splitPoint + 1)];
}

export function mergeRefs(refs: string[], options?: MergeOptions): ListMultimap<string, string> {
  const uniqueRefs = Array.from(new Set(refs));
  const unmerged: string[] = [];
  const bySharedPrefix = new ListMultimap<string, string>();
  for (const ref of uniqueRefs) {
    const pieces = splitOnRefSuffix(ref);
    if (pieces.length === 1) {
      unmerged.push(ref);
    } else {
      bySharedPrefix.put(pieces[0], ref);
    }
  }

  const mergedRefs = new ListMultimap<string, string>();
  for (const mergeableValues of Array.from(bySharedPrefix.asMap().values())) {
    mergeableValues.sort(refSorter);
    const contiguousChunks: string[][] = [];
    let currentChunk: string[] = [];
    for (const ref of mergeableValues) {
      if (currentChunk.length === 0) {
        currentChunk.push(ref);
      } else {
        const previousRef = currentChunk[currentChunk.length - 1];
        const previousPieces = splitOnRefSuffix(previousRef);
        const currentPieces = splitOnRefSuffix(ref);
        const previousSuffix = previousPieces[1]!;
        const currentSuffix = currentPieces[1]!;
        if (isContiguousSuffix(previousSuffix, currentSuffix, options)) {
          currentChunk.push(ref);
        } else {
          contiguousChunks.push(currentChunk);
          currentChunk = [ref];
        }
      }
    }
    if (currentChunk.length > 0) {
      contiguousChunks.push(currentChunk);
    }

    for (const chunk of contiguousChunks) {
      if (chunk.length === 1) {
        mergedRefs.put(chunk[0], chunk[0]);
      } else {
        const [prefix, firstSuffix] = splitOnRefSuffix(chunk[0]);
        const [, lastSuffix] = splitOnRefSuffix(chunk[chunk.length - 1]);
        const splitPoint = refSuffixIndex(chunk[0]);
        const splitCharacter = splitPoint === 0 ? "" : chunk[0].charAt(splitPoint);
        mergedRefs.putAll(`${prefix}${splitCharacter}${firstSuffix}-${lastSuffix}`, chunk);
      }
    }
  }
  unmerged.forEach(unmergedRef => mergedRefs.put(unmergedRef, unmergedRef));
  return mergedRefs.sortedCopy(refSorter);
}
