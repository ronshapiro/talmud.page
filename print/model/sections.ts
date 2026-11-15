// Resolving a Mikraot Gedolot section (a chapter range or a parsha) into what the paginator needs:
// the chapters to fetch, the first and last verse, and aliyah/parsha markers.

import {MikraotDocument, MikraotSection, SectionRange} from "./documents";
import {PARSHIYOT, ParshaInfo} from "./parshiyot";
import {tanakhBook} from "./mikraotCommentators";

export interface VerseRef {
  chapter: number;
  verse: number;
}

export function parseVerse(ref: string): VerseRef {
  const [chapter, verse] = ref.split(":").map(x => parseInt(x));
  return {chapter, verse};
}

export function compareVerses(a: VerseRef, b: VerseRef): number {
  return a.chapter !== b.chapter ? a.chapter - b.chapter : a.verse - b.verse;
}

export function parsha(id: string): ParshaInfo | undefined {
  return PARSHIYOT.find(x => x.id === id);
}

export function parshiyotForBook(book: string): ParshaInfo[] {
  return PARSHIYOT.filter(x => x.book === book);
}

export interface SectionBounds {
  startChapter: number;
  endChapter: number;
  // Inclusive verse bounds; undefined = the whole chapter range.
  from?: VerseRef;
  to?: VerseRef;
}

export function sectionBounds(book: string, range: SectionRange): SectionBounds {
  if (range.kind === "parsha") {
    const info = parsha(range.parsha);
    if (info && info.book === book) {
      const from = parseVerse(info.start);
      const to = parseVerse(info.end);
      return {startChapter: from.chapter, endChapter: to.chapter, from, to};
    }
    return {startChapter: 1, endChapter: 1};
  }
  const chapters = tanakhBook(book)?.chapters ?? range.endChapter;
  const start = Math.max(1, Math.min(range.startChapter, chapters));
  return {startChapter: start, endChapter: Math.max(start, Math.min(range.endChapter, chapters))};
}

export function inBounds(bounds: SectionBounds, verse: VerseRef): boolean {
  if (bounds.from && compareVerses(verse, bounds.from) < 0) return false;
  if (bounds.to && compareVerses(verse, bounds.to) > 0) return false;
  return verse.chapter >= bounds.startChapter && verse.chapter <= bounds.endChapter;
}

const ALIYAH_NAMES: Record<string, string> = {
  1: "ראשון",
  2: "שני",
  3: "שלישי",
  4: "רביעי",
  5: "חמישי",
  6: "שישי",
  7: "שביעי",
  M: "מפטיר",
};

export interface VerseMarker {
  // A parsha starts here (chapter ranges that cross parsha boundaries).
  parsha?: string;
  // The aliyah that starts here in this reading.
  aliyah?: string;
  // The aliyah that starts here when the parsha is read together with its neighbor.
  combinedAliyah?: string;
}

/**
 * Aliyah and parsha markers, keyed by "chapter:verse". For a combined parsha, its own aliyot are
 * the main ones; for a single parsha that is sometimes combined, the combined reading's aliyot are
 * noted alongside.
 */
export function verseMarkers(book: string, range: SectionRange): Map<string, VerseMarker> {
  const markers = new Map<string, VerseMarker>();
  const mark = (ref: string, change: VerseMarker) => {
    markers.set(ref, {...(markers.get(ref) ?? {}), ...change});
  };
  const selected = range.kind === "parsha" ? parsha(range.parsha) : undefined;
  const singles = parshiyotForBook(book).filter(x => !x.combined);
  const combined = parshiyotForBook(book).filter(x => x.combined);

  if (selected?.combined) {
    for (const aliyah of selected.aliyot) mark(aliyah.start, {aliyah: ALIYAH_NAMES[aliyah.label]});
    return markers;
  }

  for (const single of singles) {
    if (selected && single.id !== selected.id) continue;
    if (!selected) mark(single.start, {parsha: single.hebrewName});
    for (const aliyah of single.aliyot) mark(aliyah.start, {aliyah: ALIYAH_NAMES[aliyah.label]});
    const pair = combined.find(x => x.parts?.includes(single.id));
    if (!pair) continue;
    const start = parseVerse(single.start);
    const end = parseVerse(single.end);
    for (const aliyah of pair.aliyot) {
      const verse = parseVerse(aliyah.start);
      if (compareVerses(verse, start) >= 0 && compareVerses(verse, end) <= 0) {
        mark(aliyah.start, {combinedAliyah: ALIYAH_NAMES[aliyah.label]});
      }
    }
  }
  return markers;
}

export function sectionLabel(
  doc: MikraotDocument,
  section: MikraotSection,
  hebrew: boolean,
): string {
  if (section.title) return section.title;
  if (section.range.kind === "parsha") {
    const info = parsha(section.range.parsha);
    return hebrew ? `פרשת ${info?.hebrewName ?? ""}` : `Parashat ${info?.name ?? ""}`;
  }
  const {startChapter, endChapter} = section.range;
  const book = tanakhBook(doc.book);
  return hebrew
    ? `${book?.hebrewName ?? doc.book} ${startChapter}${endChapter !== startChapter ? `–${endChapter}` : ""}`
    : `${doc.book} ${startChapter}${endChapter !== startChapter ? `–${endChapter}` : ""}`;
}
