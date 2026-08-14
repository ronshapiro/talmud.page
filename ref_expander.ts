import {books} from "./books";
import {splitOnBookName} from "./refs";
import {segmentCount} from "./precomputed";

function isNumeric(x: string): boolean {
  return parseInt(x).toString() === x;
}

function pageAndSegmentNumber(combined: string, defaultPage?: string): [string, number] {
  // A segmentation-override sub-ref (precomputed/segmentation_overrides.ts) is never a valid
  // range endpoint — that design explicitly forbids composing further refs on top of one. Guard
  // for it explicitly, since its trailing segment component (e.g. the "1" in "...:split:1") is
  // still numeric on its own and wouldn't otherwise be caught by the check below.
  if (combined.includes(":split:")) {
    throw new Error(
      `"${combined}" is a synthetic segmentation-override sub-ref (contains ":split:") and `
      + "cannot be used as a range endpoint — expandRef only operates on real Sefaria refs.");
  }
  const parts = combined.split(":");
  const segmentNumberStr = parts.at(-1)!;
  if (!isNumeric(segmentNumberStr)) {
    throw new Error(
      `"${combined}" has a non-numeric trailing segment component ("${segmentNumberStr}") — `
      + "expandRef cannot expand a range endpoint that isn't a plain Sefaria segment number.");
  }
  const segmentNumber = parseInt(segmentNumberStr);
  if (parts.length === 2) {
    return [parts[0], segmentNumber];
  }
  if (!defaultPage) {
    throw new Error(
      `"${combined}" has neither a page prefix ("8a" in 8a:5) nor was a defaultPage specified`);
  }
  return [defaultPage, segmentNumber];
}

export function expandRef(ref: string): string[] | undefined {
  const [bookName, refRange] = splitOnBookName(ref);
  const book = books.byCanonicalName[bookName];
  if (!book) {
    return undefined;
  }

  if (!refRange.includes("-")) {
    return [ref];
  }

  const [start, end] = refRange.split("-");
  const [startPage, startSegment] = pageAndSegmentNumber(start);
  const [endPage, endSegment] = pageAndSegmentNumber(end, startPage);

  let currentPage = startPage;
  const expanded = [];
  const keepGoing = true; // tsc doesn't detect the break as being possible with while(true).
  while (keepGoing) {
    const currentPageRef = `${bookName} ${currentPage}`;
    const segmentsInCurrentPage = segmentCount(currentPageRef)!;
    /* eslint-disable indent */
    for (let i = (startPage === currentPage ? startSegment : 1);
         i <= (endPage === currentPage ? endSegment : segmentsInCurrentPage);
         i++) {
      /* eslint-enable indent */
      expanded.push(`${currentPageRef}:${i}`);
    }
    if (currentPage === endPage) break;
    currentPage = book.nextPage(currentPage);
  }
  return expanded;
}
