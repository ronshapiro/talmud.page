const refPieces = (ref: string): (string | number)[] => {
  const splitPoint = ref.lastIndexOf(" ", ref.indexOf(":"));
  const title = ref.substring(0, splitPoint);
  const basicPieces = ref.substring(splitPoint + 1).split(":");
  const result: (string | number)[] = [title];
  for (const piece of basicPieces) {
    const asInt = parseInt(piece);
    if (asInt) {
      result.push(asInt);
    }

    if (!asInt || asInt.toString() !== piece) {
      result.push(piece);
    }
  }
  return result;
};

type ComparisonType = string | number | (number | string)[];

const compareTo = (first: ComparisonType, second: ComparisonType): number => {
  if (first === second) return 0;
  if (Array.isArray(first) && Array.isArray(second) && first.length === second.length) {
    for (let i = 0; i < first.length; i++) {
      const itemComparison = compareTo(first[i], second[i]);
      if (itemComparison !== 0) return itemComparison;
    }
  }
  return (first < second) ? -1 : 1;
};

export const refSorter = (first: string, second: string): number => {
  return compareTo(refPieces(first), refPieces(second));
};
