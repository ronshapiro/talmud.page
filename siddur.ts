import * as _ from "underscore";

export const SEGMENT_SEPERATOR_REF = "SEGMENT_SEPERATOR_REF_VALUE";

export const SYNTHETIC_REFS = new Set([
  SEGMENT_SEPERATOR_REF,
]);

const ASHREI_REFS = [
  "Psalms 84:5",
  "Psalms 144:15",
  "Psalms 145",
  "Psalms 115:18",
];

function seperateEverySection(sections: string[]) {
  return sections.flatMap(section => [SEGMENT_SEPERATOR_REF, section]).slice(1);
}

/* eslint-disable quote-props */
export const SIDDUR_REF_REWRITING: Record<string, string[]> = {
  "Morning Blessings": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Morning Blessings",
  ],
  "Akedah": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 1",
    "Genesis 22:1-18",
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 3",
  ],
  "Sovereignty of Heaven": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven",
  ],
  "Korbanot": [
    "Numbers 28:1-8",
    SEGMENT_SEPERATOR_REF,
    "Leviticus 1:11",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Korban HaTamid 5",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Ketoret 1",
    "Exodus 30:34-36",
    "Exodus 30:7-8",
    SEGMENT_SEPERATOR_REF,
    // "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Ketoret 4-9",
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Baraita of Rabbi Yishmael",
  ],

  "Pesukei Dezimra - Introductory Psalm": [
    // nice intro!
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Introductory Psalm 1",
    "Psalms 30",
  ],
  "Barukh She'amar": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Barukh She'amar",
  ],
  "Hodu": [
    "I Chronicles 16:8-26",
    SEGMENT_SEPERATOR_REF,
    "I Chronicles 16:27-36",
    "Psalms 99:5", // Rommemus:
    "Psalms 99:9",
    SEGMENT_SEPERATOR_REF,
    "Psalms 78:38", //  vehu rachum
    "Psalms 40:12",
    "Psalms 25:6",
    "Psalms 68:35-36",
    "Psalms 94:1-2",
    "Psalms 3:9",
    "Psalms 46:8",
    "Psalms 84:13",
    "Psalms 20:10",
    SEGMENT_SEPERATOR_REF,
    "Psalms 28:9", // Hoshia et amecha
    "Psalms 33:20-22",
    "Psalms 85:8",
    "Psalms 44:27",
    "Psalms 81:11",
    "Psalms 144:15",
    "Psalms 13:6",
  ],
  "Mizmor Letoda": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Mizmor Letoda 1",
    "Psalms 100",
  ],
  "Yehi Chevod": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Yehi Chevod 1",
    "Psalms 104:31",
    "Psalms 113:2-4",
    "Psalms 135:13",
    "Psalms 103:19",
    "I Chronicles 16:31",
    "Machzor Rosh Hashanah Ashkenaz, The Morning Prayers, First Day of Rosh Hashana, Reader's Repetition.70", // Awkward!!!
    "Psalms 10:16",
    "Psalms 33:10",
    "Proverbs 19:21",
    "Psalms 33:11",
    "Psalms 33:9",
    "Psalms 132:13",
    "Psalms 135:4",
    "Psalms 94:14",
    "Psalms 78:38",
    "Psalms 20:10",
  ],
  "Ashrei": ASHREI_REFS,
  "Psalm 146": ["Psalms 146"],
  "Psalm 147": ["Psalms 147"],
  "Psalm 148": ["Psalms 148"],
  "Psalm 149": ["Psalms 149"],
  "Psalm 150": ["Psalms 150"],
  "Psalms - Closing Verses": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Closing Verses 1",
    "Psalms 89:53",
    "Psalms 135:21",
    "Psalms 72:18-19",
  ],
  "Vayevarech David": [
    "I Chronicles 29:10-13",
    SEGMENT_SEPERATOR_REF,
    "Nehemiah 9:6-11",
  ],
  "Az Yashir": [
    "Exodus 14:30-31",
    "Exodus 15:1-18",
    // repeat the duplicated pasuk
    "Exodus 15:18",
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 8",
    "Exodus 15:19",
    SEGMENT_SEPERATOR_REF,
    "Psalms 22:29",
    "Obadiah 1:21",
    "Zechariah 14:9",
  ],

  "Yishtabach": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Yishtabach",
  ],

  // "Psalm 130": ["Psalms 130"],

  "Birchot Kriat Shema": seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Barchu",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, First Blessing before Shema",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Second Blessing before Shema",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema",
  ]),

  "Amidah - Opening": seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might",
  ]),
  "Amidah - Kedusha": [
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Keduasha",
  ],
  "Amidah - Middle": seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Knowledge",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Repentance",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Forgiveness",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Redemption",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Healing",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Gathering the Exiles",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Against Enemies",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, The Righteous",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Rebuilding Jerusalem",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Kingdom of David",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Response to Prayer",
  ]),
  "Amidah - Closing": seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Birkat Kohanim",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Peace",
    // TODO: remove יִהְיוּ לְרָצוֹן at start
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Concluding Passage",
  ]),

  "Tachanun": seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot",
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Avinu Malkenu",
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, For Monday and Thursday",
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, Nefilat Apayim",
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel",
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, Shomer Yisrael",
  ]),

  "Torah": [
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Vayehi Binsoa",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Berich Shmei",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Lekha Hashem",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Av Harachamim",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Vetigaleh Veteraeh",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Birkat Hatorah 2-6",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Birkat Hatorah 8",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah 4",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah 5",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah 6",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah 7",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah 8",
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah 9",
    SEGMENT_SEPERATOR_REF,
    // TODO: prefix this with "Chazan"
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Returning Sefer to Aron, Yehalelu 2-3",
    "Psalms 24",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Returning Sefer to Aron, Uvenucho Yomar",
  ],

  "Ashrei (Conclusion)": ASHREI_REFS.concat([
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Lamenatze'ach",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion",
  ]),

  "Aleinu": seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Alenu",
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day",
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Barchi Nafshi",
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, LeDavid 1",
    "Psalms 27",
  ]),
};
/* eslint-enable quote-props */

export const SIDDUR_DEFAULT_MERGE_WITH_NEXT = new Set<string>([
  ..._.range(1, 18).map(x => `Genesis 22:${x}`),
]);

function mergePairs(
  base: string,
  ...extensionPairs: [number | string, number | string][]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [start, end] of extensionPairs) {
    result[`${base} ${start}`] = `${base} ${end}`;
  }
  return result;
}

export const SIDDUR_MERGE_PAIRS: Record<string, string> = {
  ...mergePairs(
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven", [6, 7]),

  "Exodus 30:34": "Exodus 30:36",

  ...mergePairs(
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Barchu", [2, 3], [4, 5]),

  ...mergePairs(
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema", [1, 2], [11, 12]),

  ...mergePairs("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might", [2, 3], [4, 5]),

  ...mergePairs(
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Keduasha",
    [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]),

  ...mergePairs("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity", [2, 3], [4, 5]),

  ...mergePairs("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Healing", [1, 4]),

  ...mergePairs("Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot", [6, 7]),
};

export const SIDDUR_IGNORED_FOOTNOTES: Record<string, string | string[] | number | number[]> = {
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Morning Blessings 4": 1,
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 1": 1,
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 3": 2,
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 1": [1, 2],
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 2": [4, 5, 6],
  "Psalms 30:1": "a",
  "Psalms 30:10": "d",
  "Genesis 22:6": "a",
  "I Chronicles 16:8": "c",
  "I Chronicles 16:23": "e",
  "I Chronicles 16:35": "f",
  "Psalms 145:21": "b", // Ashrei
  "Psalms 150:2": "a",
  "Exodus 15:2": "a",
  "Obadiah 1:21": "k",

  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 2": 19,
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Keduasha 2": 16,

  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, For Monday and Thursday 7": [
    23, 24, 25, 26],

  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, For Monday and Thursday 8": 27,

  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel 1": 29,
  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel 5": 29,
  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel 6": 32,
  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel 8": 33,
  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, Shomer Yisrael 5": [
    36, 38, 39, 40, 41, 43],

  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 5": [7, 8],
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 7": 9,

  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 9": [
    10, 12, 13, 14, 18, 19, 20, 21],

  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 10": 22,

  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 11": [
    25, 27, 28, 30, 31],

  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Alenu 1": 1,
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Alenu 2": [2, 3, 4],
};

export const SIDDUR_IGNORED_REFS = new Set([
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 11",
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Vayehi Binsoa 2",
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Lekha Hashem 1",
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Vetigaleh Veteraeh 1", // TODO: prefix this with "Chazan"
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Removing the Torah from Ark, Vetigaleh Veteraeh 3", // TODO prefix this with Kahal
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Birkat Hatorah 3",
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Birkat Hatorah 5",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day 1",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day 2",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day 5",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day 8",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day 11",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day 14",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day 17",
]);

export const SIDDUR_IGNORED_SOURCE_REFS = new Set([
  "Shulchan Arukh, Orach Chayim 1:5",
  "Shulchan Arukh, Orach Chayim 1:8",
  "Shulchan Arukh, Orach Chayim 51:1",
]);

export const SIDDUR_IGNORED_TARGET_REFS = new Set([
  "Rashi on Psalms 148:3:1",
  "Rashi on Psalms 150:4:1",
  "Rashi on Psalms 150:5:1",
]);


// TODO:
// - Load all, async
// - Shir Hamaalot of Aseret Yimei Teshuva
// - Fast Day Annenu
// - Modim formatting
// - Hallel
// - Permanent skip
// - Leader marks
