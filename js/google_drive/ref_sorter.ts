const refPieces = (reference: string): (string | number)[] => {
  const colonIndex = reference.indexOf(":");
  let splitPoint = colonIndex !== -1 ? reference.lastIndexOf(" ", colonIndex) : reference.lastIndexOf(" ");
  if (splitPoint === -1 && colonIndex !== -1) {
    splitPoint = colonIndex;
  }
  const title = splitPoint === -1 ? reference : reference.substring(0, splitPoint);
  const suffixString = splitPoint === -1 ? "" : reference.substring(splitPoint + 1);
  const basicPieces = suffixString ? suffixString.split(/[:-]/) : [];
  const result: (string | number)[] = [title];
  for (const piece of basicPieces) {
    const parsedInteger = parseInt(piece, 10);
    if (!Number.isNaN(parsedInteger)) {
      result.push(parsedInteger);
    }

    if (Number.isNaN(parsedInteger) || parsedInteger.toString() !== piece) {
      result.push(piece);
    }
  }
  return result;
};

type ComparisonType = string | number | (number | string)[];

const compareTo = (first: ComparisonType, second: ComparisonType): number => {
  if (first === second) return 0;
  if (Array.isArray(first) && Array.isArray(second)) {
    // Compare element-by-element up to the shorter length, rather than requiring equal lengths —
    // a length mismatch used to fall back to naive array-to-string lexicographic comparison,
    // which is wrong once the arrays' lengths can differ for reasons other than "different ref
    // entirely" (e.g. a synthetic ":split:<N>" sub-ref, which has more ":"-separated pieces than
    // the ref it was split from): comparing "9" against "10" as strings ("9" > "10") rather than
    // numbers gave the wrong order. If every compared element is equal, the shorter array (a
    // strict prefix of the longer one) sorts first.
    const minLength = Math.min(first.length, second.length);
    for (let i = 0; i < minLength; i++) {
      const itemComparison = compareTo(first[i], second[i]);
      if (itemComparison !== 0) return itemComparison;
    }
    return first.length - second.length;
  }
  return (first < second) ? -1 : 1;
};

export const refSorter = (first: string, second: string): number => {
  return compareTo(refPieces(first), refPieces(second));
};
