// Commentators available for the Mikraot Gedolot layout. This is a print-specific registry: the web
// app's ALL_COMMENTARIES (commentaries.ts) drives link matching for the web pages, and adding
// entries there would change what the web pages show.

export type TanakhSection = "Torah" | "Prophets" | "Writings";

export interface Commentator {
  id: string;
  englishName: string;
  hebrewName: string;
  // Returns the Sefaria ref for a chapter of this commentary.
  ref: (book: string, chapter: number) => string;
  sections: TanakhSection[];
  // Restrict to certain books (e.g. Radak on the Torah only covers Genesis).
  books?: string[];
  // A targum is a verse-aligned translation; rendered next to the main text rather than as a
  // commentary stream.
  isTargum?: true;
  // Default tier (1 = foundational, 2 = secondary, 0 = off) in new documents.
  defaultTier: 0 | 1 | 2;
  defaultShowEnglish: boolean;
  // Comments of these commentators start with a dibbur hamatchil in bold.
  hasDiburHamatchil?: true;
}

const on = (name: string) => (book: string, chapter: number) => `${name} on ${book} ${chapter}`;
const comma = (name: string) => (book: string, chapter: number) => `${name}, ${book} ${chapter}`;

export const COMMENTATORS: Commentator[] = [
  {
    id: "onkelos",
    englishName: "Onkelos",
    hebrewName: "תרגום אונקלוס",
    ref: (book, chapter) => `Onkelos ${book} ${chapter}`,
    sections: ["Torah"],
    isTargum: true,
    defaultTier: 0,
    defaultShowEnglish: false,
  },
  {
    id: "targum-jonathan",
    englishName: "Targum Jonathan",
    hebrewName: "תרגום יונתן",
    ref: on("Targum Jonathan"),
    sections: ["Prophets"],
    isTargum: true,
    defaultTier: 0,
    defaultShowEnglish: false,
  },
  {
    id: "rashi",
    englishName: "Rashi",
    hebrewName: "רש״י",
    ref: on("Rashi"),
    sections: ["Torah", "Prophets", "Writings"],
    defaultTier: 1,
    defaultShowEnglish: true,
    hasDiburHamatchil: true,
  },
  {
    id: "ramban",
    englishName: "Ramban",
    hebrewName: "רמב״ן",
    ref: on("Ramban"),
    sections: ["Torah"],
    defaultTier: 1,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "ibn-ezra",
    englishName: "Ibn Ezra",
    hebrewName: "אבן עזרא",
    ref: on("Ibn Ezra"),
    sections: ["Torah", "Prophets", "Writings"],
    defaultTier: 2,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "rashbam",
    englishName: "Rashbam",
    hebrewName: "רשב״ם",
    ref: on("Rashbam"),
    sections: ["Torah"],
    defaultTier: 2,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "sforno",
    englishName: "Sforno",
    hebrewName: "ספורנו",
    ref: on("Sforno"),
    sections: ["Torah"],
    defaultTier: 2,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "radak",
    englishName: "Radak",
    hebrewName: "רד״ק",
    ref: on("Radak"),
    sections: ["Torah", "Prophets", "Writings"],
    defaultTier: 0,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "or-hachaim",
    englishName: "Or HaChaim",
    hebrewName: "אור החיים",
    ref: on("Or HaChaim"),
    sections: ["Torah"],
    defaultTier: 0,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "baal-haturim",
    englishName: "Baal HaTurim",
    hebrewName: "בעל הטורים",
    ref: on("Baal HaTurim"),
    sections: ["Torah"],
    defaultTier: 0,
    defaultShowEnglish: false,
  },
  {
    id: "siftei-chakhamim",
    englishName: "Siftei Chakhamim",
    hebrewName: "שפתי חכמים",
    ref: comma("Siftei Chakhamim"),
    sections: ["Torah"],
    defaultTier: 0,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "chizkuni",
    englishName: "Chizkuni",
    hebrewName: "חזקוני",
    ref: comma("Chizkuni"),
    sections: ["Torah"],
    defaultTier: 0,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "kli-yakar",
    englishName: "Kli Yakar",
    hebrewName: "כלי יקר",
    ref: on("Kli Yakar"),
    sections: ["Torah"],
    defaultTier: 0,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "metzudat-david",
    englishName: "Metzudat David",
    hebrewName: "מצודת דוד",
    ref: on("Metzudat David"),
    sections: ["Prophets", "Writings"],
    defaultTier: 1,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "metzudat-zion",
    englishName: "Metzudat Zion",
    hebrewName: "מצודת ציון",
    ref: on("Metzudat Zion"),
    sections: ["Prophets", "Writings"],
    defaultTier: 2,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "malbim",
    englishName: "Malbim",
    hebrewName: "מלבי״ם",
    ref: on("Malbim"),
    sections: ["Torah", "Prophets", "Writings"],
    defaultTier: 0,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
  {
    id: "ralbag",
    englishName: "Ralbag",
    hebrewName: "רלב״ג",
    ref: on("Ralbag"),
    sections: ["Prophets", "Writings"],
    defaultTier: 0,
    defaultShowEnglish: false,
    hasDiburHamatchil: true,
  },
];

export const COMMENTATORS_BY_ID: Record<string, Commentator> = Object.fromEntries(
  COMMENTATORS.map(x => [x.id, x]));

export interface TanakhBookInfo {
  name: string;
  hebrewName: string;
  chapters: number;
  section: TanakhSection;
}

// Kept here (rather than imported from books.ts, which reads files from disk) so the client can
// use it.
export const TANAKH_BOOKS: TanakhBookInfo[] = [
  ["Genesis", "בראשית", 50, "Torah"],
  ["Exodus", "שמות", 40, "Torah"],
  ["Leviticus", "ויקרא", 27, "Torah"],
  ["Numbers", "במדבר", 36, "Torah"],
  ["Deuteronomy", "דברים", 34, "Torah"],
  ["Joshua", "יהושע", 24, "Prophets"],
  ["Judges", "שופטים", 21, "Prophets"],
  ["I Samuel", "שמואל א", 31, "Prophets"],
  ["II Samuel", "שמואל ב", 24, "Prophets"],
  ["I Kings", "מלכים א", 22, "Prophets"],
  ["II Kings", "מלכים ב", 25, "Prophets"],
  ["Isaiah", "ישעיהו", 66, "Prophets"],
  ["Jeremiah", "ירמיהו", 52, "Prophets"],
  ["Ezekiel", "יחזקאל", 48, "Prophets"],
  ["Hosea", "הושע", 14, "Prophets"],
  ["Joel", "יואל", 4, "Prophets"],
  ["Amos", "עמוס", 9, "Prophets"],
  ["Obadiah", "עובדיה", 1, "Prophets"],
  ["Jonah", "יונה", 4, "Prophets"],
  ["Micah", "מיכה", 7, "Prophets"],
  ["Nahum", "נחום", 3, "Prophets"],
  ["Habakkuk", "חבקוק", 3, "Prophets"],
  ["Zephaniah", "צפניה", 3, "Prophets"],
  ["Haggai", "חגי", 2, "Prophets"],
  ["Zechariah", "זכריה", 14, "Prophets"],
  ["Malachi", "מלאכי", 3, "Prophets"],
  ["Psalms", "תהילים", 150, "Writings"],
  ["Proverbs", "משלי", 31, "Writings"],
  ["Job", "איוב", 42, "Writings"],
  ["Song of Songs", "שיר השירים", 8, "Writings"],
  ["Ruth", "רות", 4, "Writings"],
  ["Lamentations", "איכה", 5, "Writings"],
  ["Ecclesiastes", "קהלת", 12, "Writings"],
  ["Esther", "אסתר", 10, "Writings"],
  ["Daniel", "דניאל", 12, "Writings"],
  ["Ezra", "עזרא", 10, "Writings"],
  ["Nehemiah", "נחמיה", 13, "Writings"],
  ["I Chronicles", "דברי הימים א", 29, "Writings"],
  ["II Chronicles", "דברי הימים ב", 36, "Writings"],
].map(([name, hebrewName, chapters, section]) => ({
  name: name as string,
  hebrewName: hebrewName as string,
  chapters: chapters as number,
  section: section as TanakhSection,
}));

export function tanakhBook(name: string): TanakhBookInfo | undefined {
  return TANAKH_BOOKS.find(x => x.name === name);
}

export function commentatorsForBook(book: string): Commentator[] {
  const info = tanakhBook(book);
  if (!info) return [];
  return COMMENTATORS.filter(
    x => x.sections.includes(info.section) && (!x.books || x.books.includes(book)));
}

export interface ResolvedCommentator {
  id: string;
  englishName: string;
  hebrewName: string;
  // The chapter ref is `${refPrefix}${chapter}`.
  refPrefix: string;
  isTargum: boolean;
}

/** Names and Sefaria ref for a commentator config: from the registry, or from the config itself. */
export function resolveCommentator(
  config: {id: string; refPrefix?: string; englishName?: string; hebrewName?: string},
  book: string,
): ResolvedCommentator | undefined {
  const known = COMMENTATORS_BY_ID[config.id];
  if (known) {
    return {
      id: config.id,
      englishName: known.englishName,
      hebrewName: known.hebrewName,
      refPrefix: known.ref(book, 1).replace(/1$/, ""),
      isTargum: Boolean(known.isTargum),
    };
  }
  if (!config.refPrefix) return undefined;
  return {
    id: config.id,
    englishName: config.englishName ?? config.refPrefix.trim(),
    hebrewName: config.hebrewName ?? config.englishName ?? config.refPrefix.trim(),
    refPrefix: config.refPrefix,
    isTargum: false,
  };
}

export function sefariaCommentatorId(refPrefix: string): string {
  return `sefaria:${refPrefix}`;
}

/** A commentary available for a chapter on Sefaria (from its links). */
export interface AvailableSource {
  refPrefix: string;
  englishName: string;
  hebrewName: string;
  category: string;
  count: number;
}
