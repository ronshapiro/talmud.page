const REF_PIECE_SPLITTER = /(.* )(\d+)(.*)([\\.:])(.*)/g;
const refPieces = (ref: string): (string| number)[] => {
  const basicPieces = ref.split(REF_PIECE_SPLITTER);
  const result = [];
  for (const piece of basicPieces) {
    const asInt = parseInt(piece);
    if (asInt) {
      result.push(asInt);
    }
    result.push(piece);
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
