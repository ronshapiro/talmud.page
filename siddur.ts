import * as _ from "underscore";

export class MergeWithNext { constructor(readonly ref: string) {} }
export class MergeRefsByDefault {
  readonly mergedRefs: Set<string> = new Set();

  constructor(readonly ref: string, withLast?: true) {
    const [prefix, suffix] = ref.split(":");
    const [start, end] = suffix.split("-");
    const delta = withLast ? 1 : 0;

    _.range(parseInt(start), parseInt(end) + delta)
      .map(x => `${prefix}:${x}`)
      .forEach(x => this.mergedRefs.add(x));
  }
}

export type RefPiece = string | MergeWithNext | MergeRefsByDefault;

export const SEGMENT_SEPERATOR_REF = "SEGMENT_SEPERATOR_REF_VALUE";

export const SYNTHETIC_REFS = new Set([
  SEGMENT_SEPERATOR_REF,
]);

const ASHREI_REFS: RefPiece[] = [
  "Psalms 84:5",
  "Psalms 144:15",
  "Psalms 145",
  "Psalms 115:18",
];

export function getRef(refPiece: RefPiece): string {
  return typeof refPiece === "string" ? refPiece : refPiece.ref;
}

function seperateEverySection(sections: string[]) {
  return sections.flatMap(section => [SEGMENT_SEPERATOR_REF, section]).slice(1);
}

export const SIDDUR_DEFAULT_MERGE_WITH_NEXT = new Set<string>([
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 1",
  "Siddur Sefard, Weekday Shacharit, Amidah 35",
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

export const DONT_MAKE_INTO_EXPLANATIONS = new Set([
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 4",
  "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 5",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 57",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 59",
  "Siddur Ashkenaz, Berachot, Birkat HaMazon 62",
].concat(Array.from(SIDDUR_DEFAULT_MERGE_WITH_NEXT)));

function akedah(ashkenaz: boolean): RefPiece[] {
  return [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 1",
    new MergeRefsByDefault("Genesis 22:1-18"),
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 3"
      : "Siddur Sefard, Weekday Shacharit, Morning Prayer 3-4",
  ];
}

function sovereigntyOfHeaven(ashkenaz: boolean): RefPiece[] {
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

function yishtabach(ashkenaz: boolean): RefPiece[] {
  return [
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Yishtabach"
      : "Siddur Sefard, Weekday Shacharit, Yishtabach 2",
    new MergeRefsByDefault("Psalms 130:1-8"),
  ];
}

function birchotKriatShema(ashkenaz: boolean): RefPiece[] {
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
    new MergeRefsByDefault("Deuteronomy 6:5-9"),
    SEGMENT_SEPERATOR_REF,
    new MergeRefsByDefault("Deuteronomy 11:13-21"),
    SEGMENT_SEPERATOR_REF,
    new MergeRefsByDefault("Numbers 15:37-41"),
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

function amidahOpening(ashkenaz: boolean): RefPiece[] {
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

function hakelHakadosh(ashkenaz: boolean): RefPiece[] {
  return [
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 1"
      : "Siddur Sefard, Weekday Shacharit, Amidah 35",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 2",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 4",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 3",
  ];
}

function barechAleinu(ashkenaz: boolean): RefPiece[] {
  return [
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 1-5",
    "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 7",
    ashkenaz
      ? "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 6"
      : "Siddur Sefard, Weekday Shacharit, Amidah 60",
  ];
}

const YEHALELU: RefPiece[] = [
  // TODO: prefix this with "Chazan"
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Returning Sefer to Aron, Yehalelu 2-3",
  new MergeRefsByDefault("Psalms 24:1-10"),
  SEGMENT_SEPERATOR_REF,
  // TODO: bold first word
  new MergeWithNext("Numbers 10:36"),
  new MergeWithNext("Psalms 132:8"),
  new MergeWithNext("Psalms 132:9"),
  new MergeWithNext("Psalms 132:10"),
  new MergeWithNext("Proverbs 4:2"),
  new MergeWithNext("Proverbs 3:17"),
  new MergeWithNext("Lamentations 5:21"),
  new MergeWithNext("Proverbs 3:17"),
  "Proverbs 3:18",
];

// Has a nice intro!
const ALEINU = "Siddur Sefard, Weekday Shacharit, Aleinu 1-4";

/* eslint-disable quote-props, dot-notation */
export const SIDDUR_REFS_ASHKENAZ: Record<string, RefPiece[]> = {
  "Morning Blessings": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Morning Blessings",
  ],
  "Akedah": akedah(true),
  "Sovereignty of Heaven": sovereigntyOfHeaven(true),
  "Korbanot": [
    new MergeRefsByDefault("Numbers 28:1-8"),
    SEGMENT_SEPERATOR_REF,
    "Leviticus 1:11",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Korban HaTamid 5",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Ketoret 1",
    new MergeRefsByDefault("Exodus 30:34-36"),
    new MergeRefsByDefault("Exodus 30:7-8"),
    SEGMENT_SEPERATOR_REF,
    // "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Ketoret 4-9",
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Baraita of Rabbi Yishmael",
  ],

  "Pesukei Dezimra - Introductory Psalm": [
    // nice intro!
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Introductory Psalm 1",
    new MergeRefsByDefault("Psalms 30:1-13"),
  ],
  "Barukh She'amar": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Barukh She'amar",
  ],
  "Hodu": [
    new MergeRefsByDefault("I Chronicles 16:8-26"),
    SEGMENT_SEPERATOR_REF,
    new MergeRefsByDefault("I Chronicles 16:27-36", true),
    new MergeWithNext("Psalms 99:5"), // Rommemus:
    "Psalms 99:9",
    SEGMENT_SEPERATOR_REF,
    new MergeWithNext("Psalms 78:38"), //  vehu rachum
    new MergeWithNext("Psalms 40:12"),
    new MergeWithNext("Psalms 25:6"),
    new MergeRefsByDefault("Psalms 68:35-36", true),
    new MergeRefsByDefault("Psalms 94:1-2", true),
    new MergeWithNext("Psalms 3:9"),
    new MergeWithNext("Psalms 46:8"),
    new MergeWithNext("Psalms 84:13"),
    new MergeWithNext("Psalms 20:10"),
    SEGMENT_SEPERATOR_REF,
    new MergeWithNext("Psalms 28:9"), // Hoshia et amecha
    new MergeRefsByDefault("Psalms 33:20-22", true),
    new MergeWithNext("Psalms 85:8"),
    new MergeWithNext("Psalms 44:27"),
    new MergeWithNext("Psalms 81:11"),
    new MergeWithNext("Psalms 144:15"),
    "Psalms 13:6",
  ],
  "Mizmor Letoda": [
    // If this is merged into a larger section, the verses will need to be ignored differently.
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Mizmor Letoda 1",
    new MergeRefsByDefault("Psalms 100:1-5"),
  ],
  "Yehi Chevod": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Yehi Chevod 1",
    new MergeWithNext("Psalms 104:31"),
    new MergeRefsByDefault("Psalms 113:2-4"),
    new MergeWithNext("Psalms 135:13"),
    new MergeWithNext("Psalms 103:19"),
    new MergeWithNext("I Chronicles 16:31"),
    new MergeWithNext("Machzor Rosh Hashanah Ashkenaz, The Morning Prayers, First Day of Rosh Hashana, Reader's Repetition.70"), // Awkward!!!
    new MergeWithNext("Psalms 10:16"),
    new MergeWithNext("Psalms 33:10"),
    new MergeWithNext("Proverbs 19:21"),
    new MergeWithNext("Psalms 33:11"),
    new MergeWithNext("Psalms 33:9"),
    new MergeWithNext("Psalms 132:13"),
    new MergeWithNext("Psalms 135:4"),
    new MergeWithNext("Psalms 94:14"),
    new MergeWithNext("Psalms 78:38"),
    "Psalms 20:10",
  ],
  "Ashrei": ASHREI_REFS,
  "Psalm 146": [
    new MergeWithNext("Psalms 146:1"),
    "Siddur Sefard, Weekday Shacharit, Hodu 20",
    new MergeRefsByDefault("Psalms 146:2-10"),
  ],
  "Psalm 147": [
    new MergeWithNext("Psalms 147:1"),
    "Siddur Sefard, Weekday Shacharit, Hodu 22",
    new MergeRefsByDefault("Psalms 147:2-20"),
  ],
  "Psalm 148": [
    new MergeWithNext("Psalms 148:1"),
    "Siddur Sefard, Weekday Shacharit, Hodu 24",
    new MergeRefsByDefault("Psalms 148:2-14"),
  ],
  "Psalm 149": [
    new MergeWithNext("Psalms 149:1"),
    "Siddur Sefard, Weekday Shacharit, Hodu 26",
    new MergeRefsByDefault("Psalms 149:2-9"),
  ],
  "Psalm 150": [
    new MergeWithNext("Psalms 150:1"),
    "Siddur Sefard, Weekday Shacharit, Hodu 28",
    new MergeRefsByDefault("Psalms 150:2-5"),
    "Psalms 150:6",
    "Psalms 150:6",
  ],
  "Psalms - Closing Verses": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Closing Verses 1",
    new MergeWithNext("Psalms 89:53"),
    new MergeWithNext("Psalms 135:21"),
    new MergeRefsByDefault("Psalms 72:18-19"),
  ],
  "Vayevarech David": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Vayevarech David 1-2",
    new MergeRefsByDefault("I Chronicles 29:10-13"),
    SEGMENT_SEPERATOR_REF,
    new MergeRefsByDefault("Nehemiah 9:6-11"),
  ],
  "Az Yashir": [
    "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Az Yashir 1",
    new MergeRefsByDefault("Exodus 14:30-31"),
    new MergeRefsByDefault("Exodus 15:1-17"),
    "Exodus 15:18",
    "Exodus 15:18", // repeat the duplicated pasuk
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 8",
    "Exodus 15:19",
    SEGMENT_SEPERATOR_REF,
    new MergeWithNext("Psalms 22:29"),
    new MergeWithNext("Obadiah 1:21"),
    "Zechariah 14:9",
  ],

  "Yishtabach": yishtabach(true),
  "Birchot Kriat Shema": birchotKriatShema(true),

  "Amidah - Opening": amidahOpening(true),
  "Amidah - Kedusha": ["Siddur Ashkenaz, Weekday, Shacharit, Amidah, Keduasha"],
  "Amidah - Middle": hakelHakadosh(true).concat(
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
    new MergeWithNext("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 1"),
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

  "Torah": ([
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
    "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah 4-9",
    SEGMENT_SEPERATOR_REF,
  ] as RefPiece[]).concat(YEHALELU),

  "Ashrei - Conclusion": ASHREI_REFS.concat([
    SEGMENT_SEPERATOR_REF,
    new MergeRefsByDefault("Psalms 20:1-10"),
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion",
  ]),

  "Aleinu": [
    ALEINU,
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Alenu",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Barchi Nafshi",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, LeDavid 1",
    new MergeRefsByDefault("Psalms 27:1-14"),
  ],
};

export const SIDDUR_REFS_SEFARD: Record<string, RefPiece[]> = {
  "Morning Blessings": [
    "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Morning Blessings 1-17",
    "Siddur Sefard, Weekday Shacharit, Blessings on Torah 26",
  ],
  "Akedah": akedah(false),
  "Sovereignty of Heaven": sovereigntyOfHeaven(false),
  "Korbanot": SIDDUR_REFS_ASHKENAZ["Korbanot"],
  "Hodu": SIDDUR_REFS_ASHKENAZ["Hodu"].concat(
    SEGMENT_SEPERATOR_REF,
    ...SIDDUR_REFS_ASHKENAZ["Pesukei Dezimra - Introductory Psalm"],
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Hodu 9-10",
    SEGMENT_SEPERATOR_REF,
    new MergeRefsByDefault("Psalms 67:1-8"),
  ),
  "Barukh She'amar": [
    "Siddur Sefard, Weekday Shacharit, Hodu 12-13",
  ],
  "Mizmor Letoda": SIDDUR_REFS_ASHKENAZ["Mizmor Letoda"],
  "Yehi Chevod": SIDDUR_REFS_ASHKENAZ["Yehi Chevod"],
  "Ashrei": SIDDUR_REFS_ASHKENAZ["Ashrei"],
  "Psalm 146": SIDDUR_REFS_ASHKENAZ["Psalm 146"],
  "Psalm 147": SIDDUR_REFS_ASHKENAZ["Psalm 147"],
  "Psalm 148": SIDDUR_REFS_ASHKENAZ["Psalm 148"],
  "Psalm 149": SIDDUR_REFS_ASHKENAZ["Psalm 149"],
  "Psalm 150": SIDDUR_REFS_ASHKENAZ["Psalm 150"],
  "Psalms - Closing Verses": SIDDUR_REFS_ASHKENAZ["Psalms - Closing Verses"],
  "Vayevarech David": SIDDUR_REFS_ASHKENAZ["Vayevarech David"],
  "Az Yashir": SIDDUR_REFS_ASHKENAZ["Az Yashir"],
  "Yishtabach": yishtabach(false),
  "Birchot Kriat Shema": birchotKriatShema(false),
  "Amidah - Opening": amidahOpening(false),
  "Amidah - Kedusha": ["Siddur Sefard, Weekday Shacharit, Amidah 22-33"],
  "Amidah - Middle": hakelHakadosh(false).concat([
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
    new MergeWithNext("Siddur Sefard, Weekday Shacharit, Amidah 65"), // השיבה שוםטינו
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
    new MergeWithNext("Siddur Sefard, Weekday Shacharit, Amidah 83"),
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
    // TODO: verify if this is the same as Ashkenaz!
    "Siddur Sefard, Weekday Shacharit, For Monday & Thursday 3-9",
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, Shomer Yisrael 1-4",
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, For Monday & Thursday 25",
  ],

  "Torah": SIDDUR_REFS_ASHKENAZ["Torah"],
  "Ashrei - Conclusion": SIDDUR_REFS_ASHKENAZ["Ashrei - Conclusion"],
  "Yehalelu": YEHALELU,

  "Conclusion": [
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day",
    "Siddur Sefard, Weekday Shacharit, Song of the Day 25",
    SEGMENT_SEPERATOR_REF,

    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Barchi Nafshi",
    SEGMENT_SEPERATOR_REF,
    "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, LeDavid 1",
    new MergeRefsByDefault("Psalms 27:1-14"),
    SEGMENT_SEPERATOR_REF,
    "Siddur Sefard, Weekday Shacharit, Kaveh 1-11",
    SEGMENT_SEPERATOR_REF,
    ALEINU,
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


export const BIRKAT_HAMAZON_REFS: Record<string, RefPiece[]> = {
  "Shir Hama'alot": [
    new MergeRefsByDefault("Psalms 126:1-6"),
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

export const SIDDUR_IGNORED_COMMENTARIES: Record<string, string[]> = {
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 8": [
    "Deuteronomy 6:4-9",
    "Deuteronomy 6:5-9",
  ],
  "Siddur Sefard, Weekday Shacharit, Morning Prayer 14": [
    "Deuteronomy 10:17",
  ],
};

export const UNSMALL_REFS = new Set([
  "Siddur Sefard, Weekday Shacharit, Amidah 17",
  "Siddur Sefard, Weekday Shacharit, Amidah 68",
  "Siddur Sefard, Weekday Shacharit, Amidah 119",
]);

export const REALLY_BIG_TEXT_REFS = new Set([
  "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Shema 3",
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 5",
]);


// These still maintain links, even though they entirely replace text.
export const HARDCODED_TEXT: Record<string, string> = {
  "Siddur Sefard, Weekday Shacharit, Hodu 13": "siddur/sefard/barukh_sheamar_{lang}.txt",
  "Siddur Sefard, Weekday Shacharit, Amidah 50": "siddur/sefard/refaeinu_{lang}.txt",
  "Siddur Sefard, Weekday Shacharit, Amidah 65": "siddur/sefard/hashiva_shoftenu_{lang}.txt",
  "Siddur Sefard, Weekday Shacharit, Amidah 71": "siddur/sefard/velamalshinim_{lang}.txt",
  "Siddur Sefard, Weekday Shacharit, Amidah 73": "siddur/sefard/al_hatzadikim_{lang}.txt",
  "Siddur Sefard, Weekday Shacharit, Amidah 79": "siddur/sefard/shomea_tefilla_{lang}.txt",
  "Siddur Sefard, Weekday Shacharit, The Shema 38": "siddur/sefard/tzur_yisrael_{lang}.txt",
};

export const HEBREW_TEXT_REPLACEMENTS: Record<string, [string, string][]> = {
  "Siddur Sefard, Weekday Shacharit, Amidah 103": [["וְיִתְרוֹמַם", "וְיִתְרוֹמֵם"]],
  "Siddur Sefard, Weekday Shacharit, The Shema 16": [
    ["מַהֵר וְהָבֵא", '<span class="tzizit-start">◰</span> מַהֵר וְהָבֵא'],
  ],
  "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Second Blessing before Shema 1": [
    ["וַהֲבִיאֵֽנוּ לְשָׁלוֹם", '<span class="tzizit-start">◰</span> וַהֲבִיאֵֽנוּ לְשָׁלוֹם'],
  ],
  "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, Blessing after Shema 9": [
    ["צוּר יִשְׂרָאֵל", "<big>צוּר יִשְׂרָאֵל</big>"],
  ],
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Concluding Passage 3": [
    [
      "עֹשֶׂה (<small>בעשי\"ת</small> הַשָּׁלוֹם) שָׁלוֹם",
      `עֹשֶׂה <span class="aseret-yimei-teshuva-word">הַשָּׁלוֹם</span> <span class="non-aseret-yimei-teshuva">שָׁלוֹם</span>`],
  ],
  "Siddur Sefard, Weekday Shacharit, Morning Prayer 8": [
    ["אַשְׁרֵֽינוּ כְּשֶׁאָֽנוּ מַשְׁכִּימִים", "אַשְׁרֵֽינוּ שֶׁאָֽנוּ מַשְׁכִּימִים"],
  ],
  "Siddur Sefard, Weekday Shacharit, Amidah 60": [
    ["וְשַׂבְּעֵֽנוּ מִטּוּבֶֽךָ", "וְשַׂבְּעֵֽנוּ מִטּוּבָהּ"],
  ],
  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot 8": [
    [
      "<b>יְהֺוָה יְהֺוָה אֵל רַחוּם וְחַנּוּן אֶֽרֶךְ אַפַּֽיִם וְרַב־חֶֽסֶד וֶאֱמֶת: נֹצֵר חֶֽסֶד לָאֲלָפִים נֹשֵׂא עָוֹן וָפֶֽשַׁע וְחַטָּאָה וְנַקֵּה:</b>",
      `<span class="really-big-text">יְהֹוָ֣ה ׀ יְהֹוָ֔ה אֵ֥ל רַח֖וּם וְחַנּ֑וּן אֶ֥רֶךְ אַפַּ֖יִם וְרַב־חֶ֥סֶד וֶאֱמֶֽת׃ נֹצֵ֥ר חֶ֙סֶד֙ לָאֲלָפִ֔ים נֹשֵׂ֥א עָוֺ֛ן וָפֶ֖שַׁע וְחַטָּאָ֑ה וְנַקֵּה֙׃</span>`,
    ],
  ],
  "Siddur Sefard, Weekday Shacharit, Amidah 41": [
    ["בִּינָה: חָנֵּֽנוּ", "בִּינָה, חָנֵּֽנוּ"],
  ],
  "Siddur Sefard, Weekday Shacharit, The Shema 10": [
    ["וְאוֹמְרִים בְּיִרְאָה", "וְאוֹמְרִים בְּיִרְאָה:"],
  ],
  "Siddur Sefard, Weekday Shacharit, Yishtabach 2": [
    ["(לְעוֹלָם וָעֶד) ", ""],
  ],
  "Siddur Sefard, Weekday Shacharit, Morning Prayer 14": [
    ["מַה־שֶּׁכָּתוּב, ", ""],
    ["כָּאָמוּר,", "כָּאָמוּר:"],
    ["ומַה תִּפְעָל", "וּמַה תִּפְעָל"],
  ],
};

export const ENGLISH_TEXT_REPLACEMENTS: Record<string, [string, string][]> = {
  "Siddur Sefard, Weekday Shacharit, Yishtabach 2": [
    ["(forever,) ", ""],
  ],
  "Siddur Sefard, Weekday Shacharit, Morning Prayer 14": [
    ["that which is written: ", ""],
    ["Zephaniah, your prophet", "Zephaniah your prophet,"],
  ],
};

export const KEEP_TROPE_REFS = new Set([
  ..._.range(5, 10).map(x => `Deuteronomy 6:${x}`),
  ..._.range(13, 22).map(x => `Deuteronomy 11:${x}`),
  ..._.range(37, 42).map(x => `Numbers 15:${x}`),
  "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot 8",
]);

export const SMALLIFY_REFS = new Set([
  "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 8",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs 2",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 4",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 6",
  "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Uva Letzion 8",
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
