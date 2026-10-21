export function splitOnBookName(ref: string): [string, string] {
  const lastSpace = ref.lastIndexOf(" ");
  return [ref.slice(0, lastSpace), ref.slice(lastSpace + 1)];
}

function rangeEndpoints(ref: string): [[string, string], [string, string]] {
  if (ref.includes("-")) {
    const [start, end] = ref.split("-");
    const [startPage, startSegment] = start.split(":");
    const endParts = end.split(":");
    if (endParts.length === 1) {
      return [[startPage, startSegment], [startPage, endParts[0]]];
    } else {
      return [[startPage, startSegment], [endParts[0], endParts[1]]];
    }
  }
  const [page, segment] = ref.split(":");
  return [[page, segment], [page, segment]];
}

/**
 * The range from the start of `first` to the end of `second`, either of which may itself be a
 * range: "Arakhin 8b:17" + "Arakhin 10a:1" -> "Arakhin 8b:17-10a:1", and "Arakhin 8b:15" +
 * "Arakhin 8b:16" -> "Arakhin 8b:15-16".
 */
export function refRange(first: string, second: string): string {
  if (first === second) return first;
  const [bookName, firstLocation] = splitOnBookName(first);
  const [, secondLocation] = splitOnBookName(second);
  const [startPage, startSegment] = rangeEndpoints(firstLocation)[0];
  const [endPage, endSegment] = rangeEndpoints(secondLocation)[1];
  return startPage === endPage
    ? `${bookName} ${startPage}:${startSegment}-${endSegment}`
    : `${bookName} ${startPage}:${startSegment}-${endPage}:${endSegment}`;
}
