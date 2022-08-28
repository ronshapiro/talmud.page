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

export const SIDDUR_DEFAULT_MERGE_WITH_NEXT = new Set<string>([
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 1",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 1",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 2",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 3",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 4",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 5",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 1",
]);

function mergeRefsByDefault(range: string, withLast?: true): string {
  const [prefix, suffix] = range.split(":");
  const [start, end] = suffix.split("-");
  const delta = withLast ? 1 : 0;
  _.range(parseInt(start), parseInt(end) + delta)
    .map(x => `${prefix}:${x}`)
    .forEach(x => SIDDUR_DEFAULT_MERGE_WITH_NEXT.add(x));
  return range;
}

function mergeWithNext(ref: string): string {
  SIDDUR_DEFAULT_MERGE_WITH_NEXT.add(ref);
  return ref;
}

/* eslint-disable quote-props */
export const SIDDUR_REF_REWRITING: Record<string, string[]> = {
  "Morning Blessings": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Morning Blessings",
  ],
  "Akedah": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 1",
    mergeRefsByDefault("Genesis 22:1-18"),
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 3",
  ],
  "Sovereignty of Heaven": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven",
  ],
  "Korbanot": [
    mergeRefsByDefault("Numbers 28:1-8"),
    SEGMENT_SEPERATOR_REF,
    "Leviticus 1:11",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Korban HaTamid 5",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Ketoret 1",
    mergeRefsByDefault("Exodus 30:34-36"),
    mergeRefsByDefault("Exodus 30:7-8"),
    SEGMENT_SEPERATOR_REF,
    // "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Ketoret 4-9",
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Baraita of Rabbi Yishmael",
  ],

  "Pesukei Dezimra - Introductory Psalm": [
    // nice intro!
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Introductory Psalm 1",
    mergeRefsByDefault("Psalms 30:1-13"),
  ],
  "Barukh She'amar": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Barukh She'amar",
  ],
  "Hodu": [
    mergeRefsByDefault("I Chronicles 16:8-26"),
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("I Chronicles 16:27-36", true),
    mergeWithNext("Psalms 99:5"), // Rommemus:
    "Psalms 99:9",
    SEGMENT_SEPERATOR_REF,
    mergeWithNext("Psalms 78:38"), //  vehu rachum
    mergeWithNext("Psalms 40:12"),
    mergeWithNext("Psalms 25:6"),
    mergeRefsByDefault("Psalms 68:35-36", true),
    mergeRefsByDefault("Psalms 94:1-2", true),
    mergeWithNext("Psalms 3:9"),
    mergeWithNext("Psalms 46:8"),
    mergeWithNext("Psalms 84:13"),
    mergeWithNext("Psalms 20:10"),
    SEGMENT_SEPERATOR_REF,
    mergeWithNext("Psalms 28:9"), // Hoshia et amecha
    mergeRefsByDefault("Psalms 33:20-22", true),
    mergeWithNext("Psalms 85:8"),
    mergeWithNext("Psalms 44:27"),
    mergeWithNext("Psalms 81:11"),
    mergeWithNext("Psalms 144:15"),
    "Psalms 13:6",
  ],
  "Mizmor Letoda": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Mizmor Letoda 1",
    mergeRefsByDefault("Psalms 100:1-5"),
  ],
  "Yehi Chevod": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Yehi Chevod 1",
    mergeWithNext("Psalms 104:31"),
    mergeRefsByDefault("Psalms 113:2-4"),
    mergeWithNext("Psalms 135:13"),
    mergeWithNext("Psalms 103:19"),
    mergeWithNext("I Chronicles 16:31"),
    mergeWithNext("Machzor Rosh Hashanah Ashkenaz, The Morning Prayers, First Day of Rosh Hashana, Reader's Repetition.70"), // Awkward!!!
    mergeWithNext("Psalms 10:16"),
    mergeWithNext("Psalms 33:10"),
    mergeWithNext("Proverbs 19:21"),
    mergeWithNext("Psalms 33:11"),
    mergeWithNext("Psalms 33:9"),
    mergeWithNext("Psalms 132:13"),
    mergeWithNext("Psalms 135:4"),
    mergeWithNext("Psalms 94:14"),
    mergeWithNext("Psalms 78:38"),
    "Psalms 20:10",
  ],
  "Ashrei": ASHREI_REFS,
  "Psalm 146": [mergeRefsByDefault("Psalms 146:1-10")],
  "Psalm 147": [mergeRefsByDefault("Psalms 147:1-20")],
  "Psalm 148": [mergeRefsByDefault("Psalms 148:1-14")],
  "Psalm 149": [mergeRefsByDefault("Psalms 149:1-9")],
  "Psalm 150": [mergeRefsByDefault("Psalms 150:1-6")],
  "Psalms - Closing Verses": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Closing Verses 1",
    mergeWithNext("Psalms 89:53"),
    mergeWithNext("Psalms 135:21"),
    mergeRefsByDefault("Psalms 72:18-19"),
  ],
  "Vayevarech David": [
    mergeRefsByDefault("I Chronicles 29:10-13"),
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Nehemiah 9:6-11"),
  ],
  "Az Yashir": [
    mergeRefsByDefault("Exodus 14:30-31"),
    mergeRefsByDefault("Exodus 15:1-17"),
    "Exodus 15:18",
    "Exodus 15:18", // repeat the duplicated pasuk
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 8",
    "Exodus 15:19",
    SEGMENT_SEPERATOR_REF,
    mergeWithNext("Psalms 22:29"),
    mergeWithNext("Obadiah 1:21"),
    "Zechariah 14:9",
  ],

  "Yishtabach": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Yishtabach",
    mergeRefsByDefault("Psalms 130:1-8"),
  ],

  "Birchot Kriat Shema": seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Barchu",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, First Blessing before Shema",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Second Blessing before Shema",
  ]).concat([
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 1-2",
    // This explanation should really be between 3 (the pasuk of Shema) and Baruch Shem (5). So
    // it's moved up so that it will be treated like a hachana.
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 4",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 3",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 5",

  ]).concat(seperateEverySection([
    mergeRefsByDefault("Deuteronomy 6:5-9"),
    mergeRefsByDefault("Deuteronomy 11:13-21"),
    mergeRefsByDefault("Numbers 15:37-41"),
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 9-12",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema",
  ])),

  "Amidah - Opening": [
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 1-3",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 6",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 4-5",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 7",
  ],
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
  "Amidah - Closing": [
    // The merging is only applied when Ya'ale v'yavo is not said. If it is, the segment
    // seperator breaks the merging.
    mergeWithNext("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 1"),
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 4",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 3",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 5",
    SEGMENT_SEPERATOR_REF,
  ].concat(seperateEverySection([
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving",
    // TODO: add Birkat kohanim, but improve formatting and add Israel version too.
    // "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Birkat Kohanim",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Peace",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Concluding Passage 2-4",
  ])),

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
    mergeRefsByDefault("Psalms 24:1-10"),
    SEGMENT_SEPERATOR_REF,
    // TODO: bold first word
    mergeWithNext("Numbers 10:36"),
    mergeWithNext("Psalms 132:8"),
    mergeWithNext("Psalms 132:9"),
    mergeWithNext("Psalms 132:10"),
    mergeWithNext("Proverbs 4:2"),
    mergeWithNext("Proverbs 3:17"),
    mergeWithNext("Lamentations 5:21"),
    mergeWithNext("Proverbs 3:17"),
    "Proverbs 3:18",
  ],

  "Ashrei - Conclusion": ASHREI_REFS.concat([
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Psalms 20:1-10"),
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

// These merges, as opposed to SIDDUR_DEFAULT_MERGE_WITH_NEXT are undeniably linked, and should
// always be considered one section.
export const SIDDUR_MERGE_PAIRS: Record<string, string> = {
  ...mergePairs(
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven", [6, 7]),

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
// - Review section labels
// - Hebrew section labels in UI
// - Hallel
// - Birkat Hamazon

// TODO(lower):
// - Modim formatting
// - Removal of Lamnatzeach after ashrei. But this needs more sophisticated removal logic as the
//   verses are sometimes included elsewhere.
// parse-out Kri-ketiv?
// - sugya break after ata chonen, goel yisrael
// - Permanent skip
// - Leader marks
// - Rabbi Yishmael bolding
