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
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 10",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 10-11",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 37",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 38",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 39",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 41",
  "Siddur Sefard, Weekday Shacharit, Amidah 50",
  "Siddur Sefard, Weekday Shacharit, Amidah 51",
  "Siddur Sefard, Weekday Shacharit, Amidah 52",
  "Siddur Sefard, Weekday Shacharit, Amidah 53",
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

function akedah(ashkenaz: boolean): string[] {
  return [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 1",
    mergeRefsByDefault("Genesis 22:1-18"),
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 3"
      : "Siddur Sefard, Weekday Shacharit, Morning Prayer 3-4",
  ];
}

function sovereigntyOfHeaven(ashkenaz: boolean): string[] {
  return [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 1",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 2"
      : "Siddur Sefard, Weekday Shacharit, Morning Prayer 6",
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 3",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 4"
      : "Siddur Sefard, Weekday Shacharit, Morning Prayer 8",
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 5-8",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 9-10"
      : "Siddur Sefard, Weekday Shacharit, Morning Prayer 13-14",
  ];
}

function yishtabach(ashkenaz: boolean): string[] {
  return [
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Yishtabach"
      : "Siddur Sefard, Weekday Shacharit, Yishtabach 2",
    mergeRefsByDefault("Psalms 130:1-8"),
  ];
}

function birchotKriatShema(ashkenaz: boolean): string[] {
  return [
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Barchu",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, First Blessing before Shema 1",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, First Blessing before Shema 2-4"
      : "Siddur Sefard, Weekday Shacharit, The Shema 8-10",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, First Blessing before Shema 5-7",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, First Blessing before Shema 8"
      : "Siddur Sefard, Weekday Shacharit, The Shema 14",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, The Shema 15", // nice intro
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Second Blessing before Shema"
      : "Siddur Sefard, Weekday Shacharit, The Shema 16",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 1-2",
    // This explanation should really be between 3 (the pasuk of Shema) and Baruch Shem (5). So
    // it's moved up so that it will be treated like a hachana.
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 4",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 3",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 5",
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Deuteronomy 6:5-9"),
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Deuteronomy 11:13-21"),
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Numbers 15:37-41"),
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 9-12",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 1-2",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 3-5"
      : "Siddur Sefard, Weekday Shacharit, The Shema 32-34",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 6",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 7"
      : "Siddur Sefard, Weekday Shacharit, The Shema 36",
    "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 8",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 9"
      : "Siddur Sefard, Weekday Shacharit, The Shema 38",
  ];
}

function amidahOpening(ashkenaz: boolean): string[] {
  return [
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 1-3",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 6",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 4-5",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 7",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 8"
      : "Siddur Sefard, Weekday Shacharit, Amidah 17",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 9-10",
  ];
}

const HAKEL_HAKADOSH = [
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 1-2",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 4",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 3",
];

function barechAleinu(ashkenaz: boolean): string[] {
  return [
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 1-5",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 7",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 6"
      : "Siddur Sefard, Weekday Shacharit, Amidah 60",
  ];
}

const YEHALELU = [
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
];

/* eslint-disable quote-props, dot-notation */
export const SIDDUR_REF_REWRITING: Record<string, string[]> = {
  "Morning Blessings": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Morning Blessings",
  ],
  "Akedah": akedah(true),
  "Sovereignty of Heaven": sovereigntyOfHeaven(true),
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
    // If this is merged into a larger section, the verses will need to be ignored differently.
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
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Vayevarech David 1-2",
    mergeRefsByDefault("I Chronicles 29:10-13"),
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Nehemiah 9:6-11"),
  ],
  "Az Yashir": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Az Yashir 1",
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

  "Yishtabach": yishtabach(true),
  "Birchot Kriat Shema": birchotKriatShema(true),

  "Amidah - Opening": amidahOpening(true),
  "Amidah - Kedusha": ["Siddur Ashkenaz, Weekday, Shacharit, Amidah, Keduasha"],
  "Amidah - Middle": HAKEL_HAKADOSH.concat(
    SEGMENT_SEPERATOR_REF,
    seperateEverySection([
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Knowledge",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Repentance",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Forgiveness",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Redemption 1",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Healing",
    ]),
    SEGMENT_SEPERATOR_REF,
    ...barechAleinu(true),
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Gathering the Exiles",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 1-2",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 4",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 3",
    SEGMENT_SEPERATOR_REF,
    seperateEverySection([
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Against Enemies",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, The Righteous",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Rebuilding Jerusalem",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Kingdom of David",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Response to Prayer",
    ])),
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
  ].concat(YEHALELU),

  "Ashrei - Conclusion": ASHREI_REFS.concat([
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Psalms 20:1-10"),
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion",
  ]),

  "Aleinu": [
    "Siddur Sefard, Weekday Shacharit, Aleinu 1", // nice intro!
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Alenu",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Barchi Nafshi",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, LeDavid 1",
    "Psalms 27",
  ],
};

export const SIDDUR_REFS_SEFARD: Record<string, string[]> = {
  "Morning Blessings": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Morning Blessings 1-17",
    "Siddur Sefard, Weekday Shacharit, Blessings on Torah 26",
  ],
  "Akedah": akedah(false),
  "Sovereignty of Heaven": sovereigntyOfHeaven(false),
  "Korbanot": SIDDUR_REF_REWRITING["Korbanot"],
  "Hodu": SIDDUR_REF_REWRITING["Hodu"].concat(
    SEGMENT_SEPERATOR_REF,
    ...SIDDUR_REF_REWRITING["Pesukei Dezimra - Introductory Psalm"],
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Hodu 9-10",
    SEGMENT_SEPERATOR_REF,
    mergeRefsByDefault("Psalms 67:1-8"),
  ),
  "Barukh She'amar": [
    "Siddur Sefard, Weekday Shacharit, Hodu 12-13",
  ],
  "Mizmor Letoda": SIDDUR_REF_REWRITING["Mizmor Letoda"],
  "Yehi Chevod": SIDDUR_REF_REWRITING["Yehi Chevod"],
  "Ashrei": SIDDUR_REF_REWRITING["Ashrei"],
  "Psalm 146": SIDDUR_REF_REWRITING["Psalm 146"],
  "Psalm 147": SIDDUR_REF_REWRITING["Psalm 147"],
  "Psalm 148": SIDDUR_REF_REWRITING["Psalm 148"],
  "Psalm 149": SIDDUR_REF_REWRITING["Psalm 149"],
  "Psalm 150": SIDDUR_REF_REWRITING["Psalm 150"],
  "Psalms - Closing Verses": SIDDUR_REF_REWRITING["Psalms - Closing Verses"],
  "Vayevarech David": SIDDUR_REF_REWRITING["Vayevarech David"],
  "Az Yashir": SIDDUR_REF_REWRITING["Az Yashir"],
  "Yishtabach": yishtabach(false),
  "Birchot Kriat Shema": birchotKriatShema(false),
  "Amidah - Opening": amidahOpening(false),
  "Amidah - Kedusha": ["Siddur Sefard, Weekday Shacharit, Amidah 22-33"],
  "Amidah - Middle": HAKEL_HAKADOSH.concat([
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 41",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Repentance",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 45",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 47",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 50-53",
    SEGMENT_SEPERATOR_REF,
    ...barechAleinu(false),
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 63", // תקע בשופר
    SEGMENT_SEPERATOR_REF,
    mergeWithNext("Siddur Sefard, Weekday Shacharit, Amidah 65"), // השיבה שוםטינו
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 4",
    "Siddur Sefard, Weekday Shacharit, Amidah 66",
    // this hachana is repeated so that it's always present, whether or not its Aseret Yimei Teshuva
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 4",
    "Siddur Sefard, Weekday Shacharit, Amidah 68",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 71", // ולמלשינים
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 73", // עַל־הַצַּדִּיקִים
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 75", // וְלִירוּשָׁלַֽיִם
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Kingdom of David",
    SEGMENT_SEPERATOR_REF,
    // TODO: 81 has a prayer for sustenance?
    "Siddur Sefard, Weekday Shacharit, Amidah 79",
  ]),

  "Amidah - Closing": [
    // The merging is only applied when Ya'ale v'yavo is not said. If it is, the segment
    // seperator breaks the merging.
    mergeWithNext("Siddur Sefard, Weekday Shacharit, Amidah 83"),
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 4",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 3",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 5",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 1",
    "Siddur Sefard, Weekday Shacharit, Amidah 94", // מודים
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 3-5",
    "Siddur Sefard, Weekday Shacharit, Amidah 98",
    "Siddur Sefard, Weekday Shacharit, Amidah 100",
    "Siddur Sefard, Weekday Shacharit, Amidah 102",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 103",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 11",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 10",
    "Siddur Sefard, Weekday Shacharit, Amidah 107",
    SEGMENT_SEPERATOR_REF,
    // TODO: add Birkat kohanim, but improve formatting and add Israel version too.
    // "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Birkat Kohanim",
    "Siddur Sefard, Weekday Shacharit, Amidah 117", // שים שלום
    "Siddur Sefard, Weekday Shacharit, Amidah 120",
    "Siddur Sefard, Weekday Shacharit, Amidah 119",
    "Siddur Sefard, Weekday Shacharit, Amidah 121",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Amidah 123", // conclusion
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Concluding Passage 3-4",
  ],

  "Tachanun": [
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, Nefilat Apayim",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Avinu Malkenu",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, For Monday and Thursday 1",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, For Monday & Thursday 3-9",
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, Shomer Yisrael 1-4",
    "Siddur Sefard, Weekday Shacharit, For Monday & Thursday 25",
  ],

  "Torah": SIDDUR_REF_REWRITING["Torah"],
  "Ashrei - Conclusion": SIDDUR_REF_REWRITING["Ashrei - Conclusion"],
  "Yehalelu": YEHALELU,

  "Conclusion": [
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day",
    "Siddur Sefard, Weekday Shacharit, Song of the Day 25",
    SEGMENT_SEPERATOR_REF,

    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Barchi Nafshi",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, LeDavid 1",
    SEGMENT_SEPERATOR_REF,
    "Psalms 27",
    "Siddur Sefard, Weekday Shacharit, Kaveh 1-11",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Aleinu 1-4",
  ],
};

function checkUndefinedRefs() {
  const sections = [];
  for (const [section, refs] of Object.entries(SIDDUR_REFS_SEFARD)) {
    if (refs === undefined) {
      sections.push(section);
      break;
    }
    for (const ref of refs) {
      if (ref === undefined) {
        sections.push(section);
        break;
      }
    }
  }
  if (sections.length > 0) {
    throw new Error("Sefard sections with undefined refs: " + sections.join(", "));
  }
}
checkUndefinedRefs();


export const BIRKAT_HAMAZON_REFS: Record<string, string[]> = {
  "Shir Hama'alot": [
    mergeRefsByDefault("Psalms 126:1-6"),
  ],
  "Zimun": [
    "Siddur Ashkenaz, Berachot, Birkat HaMazon 6-20",
  ],
  "Birkat Hamazon": [
    "Siddur Ashkenaz, Berachot, Birkat HaMazon 21-81",
  ],
};
/* eslint-enable quote-props, dot-notation */

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

  ...mergePairs(
    "Siddur Sefard, Weekday Shacharit, Amidah",
    [22, 23], [24, 25], [26, 27], [28, 29], [30, 31], [32, 33]),

  ...mergePairs("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity", [2, 3], [4, 5]),

  ...mergePairs("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Healing", [1, 4]),

  ...mergePairs("Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot", [6, 7]),

  ...mergePairs(
    "Siddur Ashkenaz, Berachot, Birkat HaMazon",
    [6, 7], [8, 9], [10, 11], [14, 15], [16, 17], [18, 19]),
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
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 12",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 27",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 29",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 35",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 40",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 42",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 43",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 44",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 65",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 66",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 69",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 70",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 71",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 72",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 78",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 79",
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
// - Hebrew section labels in UI (and also "invisible" section labels)
// - Hallel
// - Musaf on RC and Chol Hamoed
// - breakup verses in Tachanun
// - Avinu Malkenu calendarize
// - Zikaron -> Zachrenu

// TODO (Sefard):
// - Annenu
// - Review all hachanot in Sefaria, including Hodu's
// - Switch order of Sheasa li kol tzorchi and hamechin ltzadei gaver

// TODO(lower):
// - Barchi Nafshi and ledavid by verse
// - Modim formatting
// - Removal of Lamnatzeach after ashrei. But this needs more sophisticated removal logic as the
//   verses are sometimes included elsewhere.
// parse-out Kri-ketiv?
// - sugya break after ata chonen, goel yisrael
// - Permanent skip
// - Leader marks
// - Rabbi Yishmael bolding
