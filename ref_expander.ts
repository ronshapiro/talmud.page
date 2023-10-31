import {books} from "./books";
import {splitOnBookName} from "./refs";
import {segmentCount} from "./precomputed";

function pageAndSegmentNumber(combined: string, defaultPage?: string): [string, number] {
  const parts = combined.split(":");
  const segmentNumber = parseInt(parts.at(-1)!);
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
