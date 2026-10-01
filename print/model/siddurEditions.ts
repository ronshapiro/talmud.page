// Siddur editions and their tables of contents.
//
// An edition is an ordered list of sections. Each section has a data source:
//   - "curated": a talmud.page siddur page (e.g. /SiddurAshkenaz/Hodu). These already have
//     segment merging, explanations and text cleanup applied by api_request_handler.ts.
//   - "sefaria": a raw Sefaria ref, for parts of the siddur that talmud.page doesn't curate yet.
//
// Only Nusach Ashkenaz is enabled today. The other editions are registered so that documents,
// the editor and the data layer are all edition-aware from the start.

export type SectionSource =
  | {kind: "curated"; book: string; page: string}
  | {kind: "sefaria"; ref: string};

export interface SiddurSectionDef {
  id: string;
  title: string;
  titleHebrew: string;
  group: string;
  groupHebrew: string;
  source: SectionSource;
}

export interface SiddurEdition {
  id: string;
  title: string;
  titleHebrew: string;
  enabled: boolean;
  note?: string;
  sections: SiddurSectionDef[];
}

function curated(
  book: string,
  group: string,
  groupHebrew: string,
  pages: [string, string][],
): SiddurSectionDef[] {
  return pages.map(([page, titleHebrew]) => ({
    id: `${book}/${page}`,
    title: page,
    titleHebrew,
    group,
    groupHebrew,
    source: {kind: "curated", book, page},
  }));
}

function sefaria(
  prefix: string,
  group: string,
  groupHebrew: string,
  leaves: [string, string, string?][],
): SiddurSectionDef[] {
  return leaves.map(([leaf, titleHebrew, title]) => ({
    id: `${prefix}, ${leaf}`,
    title: title ?? leaf,
    titleHebrew,
    group,
    groupHebrew,
    source: {kind: "sefaria", ref: `${prefix}, ${leaf}`},
  }));
}

const SHACHARIT_ASHKENAZ: [string, string][] = [
  ["Morning Blessings", "ברכות השחר"],
  ["Akedah", "עקידה"],
  ["Sovereignty of Heaven", "עול מלכות שמים"],
  ["Korbanot", "קורבנות"],
  ["Pesukei Dezimra - Introductory Psalm", "מזמור שיר"],
  ["Hodu", "הודו"],
  ["Barukh She'amar", "ברוך שאמר"],
  ["Mizmor Letoda", "מזמור לתודה"],
  ["Yehi Chevod", "יהי כבוד"],
  ["Ashrei", "אשרי"],
  ["Psalm 146", "תהילים קמו"],
  ["Psalm 147", "תהילים קמז"],
  ["Psalm 148", "תהילים קמח"],
  ["Psalm 149", "תהילים קמט"],
  ["Psalm 150", "תהילים קנ"],
  ["Psalms - Closing Verses", "סיום תהילים"],
  ["Vayevarech David", "ויברך דוד"],
  ["Az Yashir", "אז ישיר"],
  ["Yishtabach", "ישתבח"],
  ["Birchot Kriat Shema", "קריאת שמע"],
  ["Amidah - Opening", "עמידה"],
  ["Amidah - Kedusha", "קדושה"],
  ["Amidah - Middle", "עמידה - אמצע"],
  ["Amidah - Closing", "עמידה - סיום"],
  ["Tachanun", "תחנון"],
  ["Torah", "קריאת התורה"],
  ["Ashrei - Conclusion", "אשרי"],
  ["Aleinu", "עלינו"],
];

const KABBALAT_SHABBAT: [string, string, string?][] = [
  ["Yedid Nefesh", "ידיד נפש"],
  ["Psalm 95", "לכו נרננה"],
  ["Psalm 96", "שירו לה׳ שיר חדש"],
  ["Psalm 97", "ה׳ מלך תגל הארץ"],
  ["Psalm 98", "מזמור שירו לה׳"],
  ["Psalm 99", "ה׳ מלך ירגזו עמים"],
  ["Psalm 29", "מזמור לדוד"],
  ["Ana Bekoach", "אנא בכח"],
  ["Lekha Dodi", "לכה דודי"],
  ["Psalm 92", "מזמור שיר ליום השבת"],
  ["Psalm 93", "ה׳ מלך גאות לבש"],
];

const SHABBAT_EVENING: [string, string, string?][] = [
  ["Shalom Aleichem", "שלום עליכם"],
  ["Blessing the Children", "ברכת הבנים"],
  ["Eshet Chayil", "אשת חיל"],
  ["Kiddush", "קידוש"],
];

export const SIDDUR_EDITIONS: SiddurEdition[] = [
  {
    id: "ashkenaz",
    title: "Siddur — Nusach Ashkenaz",
    titleHebrew: "סידור נוסח אשכנז",
    enabled: true,
    sections: [
      ...curated("SiddurAshkenaz", "Weekday Shacharit", "שחרית לחול", SHACHARIT_ASHKENAZ),
      ...sefaria(
        "Siddur Ashkenaz, Shabbat, Kabbalat Shabbat", "Kabbalat Shabbat", "קבלת שבת", KABBALAT_SHABBAT),
      ...sefaria(
        "Siddur Ashkenaz, Shabbat, Shabbat Evening", "Shabbat Evening", "ליל שבת", SHABBAT_EVENING),
      ...curated("BirkatHamazon", "Birkat Hamazon", "ברכת המזון", [
        ["Shir Hama'alot", "שיר המעלות"],
        ["Zimun", "זימון"],
        ["Birkat Hamazon", "ברכת המזון"],
      ]),
    ],
  },
  {
    id: "sefard",
    title: "Siddur — Nusach Sefard",
    titleHebrew: "סידור נוסח ספרד",
    enabled: false,
    note: "Planned. Sefaria's Siddur Sefard text is partial; enable once its sections are mapped.",
    sections: [],
  },
  {
    id: "koren-sacks-machzor-rosh-hashana",
    title: "Koren Sacks Rosh HaShana Machzor",
    titleHebrew: "מחזור קורן לראש השנה",
    enabled: false,
    note: "Planned. Requires a Machzor text source.",
    sections: [],
  },
  {
    id: "koren-sacks-machzor-yom-kippur",
    title: "Koren Sacks Yom Kippur Machzor",
    titleHebrew: "מחזור קורן ליום כיפור",
    enabled: false,
    note: "Planned. Requires a Machzor text source.",
    sections: [],
  },
];

export function siddurEdition(id: string): SiddurEdition {
  const edition = SIDDUR_EDITIONS.find(x => x.id === id);
  if (!edition) throw new Error(`Unknown siddur edition: ${id}`);
  return edition;
}

export function siddurSection(editionId: string, sectionId: string): SiddurSectionDef {
  const section = siddurEdition(editionId).sections.find(x => x.id === sectionId);
  if (!section) throw new Error(`Unknown section ${sectionId} in edition ${editionId}`);
  return section;
}
