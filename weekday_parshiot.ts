/* eslint-disable quote-props */
import {JewishCalendar, HebrewDateFormatter} from "kosher-zmanim";


const ALIYOT: Record<string, string[]> = {
  "Achrei Mot": [
    "Leviticus 16:1-6",
    "Leviticus 16:7-11",
    "Leviticus 16:12-17",
  ],
  "Achrei Mot-Kedoshim": [
    "Leviticus 16:1-6",
    "Leviticus 16:7-11",
    "Leviticus 16:12-17",
  ],
  "Balak": [
    "Numbers 22:2-4",
    "Numbers 22:5-7",
    "Numbers 22:8-12",
  ],
  "Bamidbar": [
    "Numbers 1:1-4",
    "Numbers 1:5-16",
    "Numbers 1:17-19",
  ],
  "Bechukotai": [
    "Leviticus 26:3-5",
    "Leviticus 26:6-9",
    "Leviticus 26:10-13",
  ],
  "Beha'alotcha": [
    "Numbers 8:1-4",
    "Numbers 8:5-9",
    "Numbers 8:10-14",
  ],
  "Behar": [
    "Leviticus 25:1-3",
    "Leviticus 25:4-7",
    "Leviticus 25:8-13",
  ],
  "Behar-Bechukotai": [
    "Leviticus 25:1-3",
    "Leviticus 25:4-7",
    "Leviticus 25:8-13",
  ],
  "Bereshit": [
    "Genesis 1:1-5",
    "Genesis 1:6-8",
    "Genesis 1:9-13",
  ],
  "Beshalach": [
    "Exodus 13:17-22",
    "Exodus 14:1-4",
    "Exodus 14:5-8",
  ],
  "Bo": [
    "Exodus 10:1-3",
    "Exodus 10:4-6",
    "Exodus 10:7-11",
  ],
  "Chayei Sara": [
    "Genesis 23:1-7",
    "Genesis 23:8-12",
    "Genesis 23:13-16",
  ],
  "Chukat": [
    "Numbers 19:1-6",
    "Numbers 19:7-9",
    "Numbers 19:10-17",
  ],
  "Chukat-Balak": [
    "Numbers 19:1-6",
    "Numbers 19:7-9",
    "Numbers 19:10-17",
  ],
  "Devarim": [
    "Deuteronomy 1:1-3",
    "Deuteronomy 1:4-7",
    "Deuteronomy 1:8-11",
  ],
  "Eikev": [
    "Deuteronomy 7:12-21",
    "Deuteronomy 7:22-8:3",
    "Deuteronomy 8:4-10",
  ],
  "Emor": [
    "Leviticus 21:1-6",
    "Leviticus 21:7-12",
    "Leviticus 21:13-15",
  ],
  "Ha'Azinu": [
    "Deuteronomy 32:1-3",
    "Deuteronomy 32:4-6",
    "Deuteronomy 32:7-12",
  ],
  "Kedoshim": [
    "Leviticus 19:1-4",
    "Leviticus 19:5-10",
    "Leviticus 19:11-14",
  ],
  "Ki Tavo": [
    "Deuteronomy 26:1-:3",
    "Deuteronomy 26:4-:11",
    "Deuteronomy 26:12-:15",
  ],
  "Ki Teitzei": [
    "Deuteronomy 21:10-14",
    "Deuteronomy 21:15-17",
    "Deuteronomy 21:18-21",
  ],
  "Ki Tisa": [
    "Exodus 30:11-13",
    "Exodus 30:14-16",
    "Exodus 30:17-21",
  ],
  "Korach": [
    "Numbers 16:1-3",
    "Numbers 16:4-7",
    "Numbers 16:8-13",
  ],
  "Lech Lecha": [
    "Genesis 12:1-3",
    "Genesis 12:4-9",
    "Genesis 12:10-13",
  ],
  "Masei": [
    "Numbers 33:1-3",
    "Numbers 33:4-6",
    "Numbers 33:7-10",
  ],
  "Matot": [
    "Numbers 30:2-9",
    "Numbers 30:10-13",
    "Numbers 30:14-17",
  ],
  "Matot-Masei": [
    "Numbers 30:2-9",
    "Numbers 30:10-13",
    "Numbers 30:14-17",
  ],
  "Metzora": [
    "Leviticus 14:1-5",
    "Leviticus 14:6-9",
    "Leviticus 14:10-12",
  ],
  "Miketz": [
    "Genesis 41:1-4",
    "Genesis 41:5-7",
    "Genesis 41:8-14",
  ],
  "Mishpatim": [
    "Exodus 21:1-6",
    "Exodus 21:7-11",
    "Exodus 21:12-19",
  ],
  "Nasso": [
    "Numbers 4:21-24",
    "Numbers 4:25-28",
    "Numbers 4:29-33",
  ],
  "Nitzavim": [
    "Deuteronomy 29:9-11",
    "Deuteronomy 29:12-14",
    "Deuteronomy 29:15-28",
  ],
  "Nitzavim-Vayeilech": [
    "Deuteronomy 29:9-11",
    "Deuteronomy 29:12-14",
    "Deuteronomy 29:15-28",
  ],
  "Noach": [
    "Genesis 6:9-16",
    "Genesis 6:17-19",
    "Genesis 6:20-22",
  ],
  "Pekudei": [
    "Exodus 38:21-23",
    "Exodus 38:24-27",
    "Exodus 38:28-39:1",
  ],
  "Pinchas": [
    "Numbers 25:10-12",
    "Numbers 25:13-15",
    "Numbers 25:16-26:4",
  ],
  "Re'eh": [
    "Deuteronomy 11:26-31",
    "Deuteronomy 11:32-12:5",
    "Deuteronomy 12:6-10",
  ],
  "Sh'lach": [
    "Numbers 13:1-3",
    "Numbers 13:4-16",
    "Numbers 13:17-20",
  ],
  "Shemot": [
    "Exodus 1:1-7",
    "Exodus 1:8-12",
    "Exodus 1:13-17",
  ],
  "Shmini": [
    "Leviticus 9:1-6",
    "Leviticus 9:7-10",
    "Leviticus 9:11-16",
  ],
  "Shoftim": [
    "Deuteronomy 16:18-20",
    "Deuteronomy 16:21-17:10",
    "Deuteronomy 17:11-13",
  ],
  "Tazria": [
    "Leviticus 12:1-4",
    "Leviticus 12:5-8",
    "Leviticus 13:1-5",
  ],
  "Tazria-Metzora": [
    "Leviticus 12:1-4",
    "Leviticus 12:5-8",
    "Leviticus 13:1-5",
  ],
  "Terumah": [
    "Exodus 25:1-5",
    "Exodus 25:6-9",
    "Exodus 25:10-16",
  ],
  "Tetzaveh": [
    "Exodus 27:20-28:5",
    "Exodus 28:6-9",
    "Exodus 28:10-12",
  ],
  "Toldot": [
    "Genesis 25:19-22",
    "Genesis 25:23-26",
    "Genesis 25:27-26:5",
  ],
  "Tzav": [
    "Leviticus 6:1-3",
    "Leviticus 6:4-6",
    "Leviticus 6:7-11",
  ],
  "Vaera": [
    "Exodus 6:2-5",
    "Exodus 6:6-9",
    "Exodus 6:10-13",
  ],
  "Vaetchanan": [
    "Deuteronomy 3:23-25",
    "Deuteronomy 3:26-4:4",
    "Deuteronomy 4:5-8",
  ],
  "Vayakhel": [
    "Exodus 35:1-3",
    "Exodus 35:4-10",
    "Exodus 35:11-20",
  ],
  "Vayakhel-Pekudei": [
    "Exodus 35:1-3",
    "Exodus 35:4-10",
    "Exodus 35:11-20",
  ],
  "Vayechi": [
    "Genesis 47:28-31",
    "Genesis 48:1-3",
    "Genesis 48:4-9",
  ],
  "Vayeilech": [
    "Deuteronomy 31:1-3",
    "Deuteronomy 31:4-6",
    "Deuteronomy 31:7-13",
  ],
  "Vayera": [
    "Genesis 18:1-5",
    "Genesis 18:6-8",
    "Genesis 18:9-14",
  ],
  "Vayeshev": [
    "Genesis 37:1-3",
    "Genesis 37:4-7",
    "Genesis 37:8-11",
  ],
  "Vayetzei": [
    "Genesis 28:10-12",
    "Genesis 28:13-17",
    "Genesis 28:18-22",
  ],
  "Vayigash": [
    "Genesis 44:18-20",
    "Genesis 44:21-24",
    "Genesis 44:25-30",
  ],
  "Vayikra": [
    "Leviticus 1:1-4",
    "Leviticus 1:5-9",
    "Leviticus 1:10-13",
  ],
  "Vayishlach": [
    "Genesis 32:4-6",
    "Genesis 32:7-9",
    "Genesis 32:10-13",
  ],
  "Yitro": [
    "Exodus 18:1-4",
    "Exodus 18:5-8",
    "Exodus 18:9-12",
  ],
  "Vezot Habracha": [
    "Deuteronomy 33:1-7",
    "Deuteronomy 33:8-12",
    "Deuteronomy 33:13-17",
  ],
};

const ROSH_CHODESH = [
  "Numbers 28:1-3",
  "Numbers 28:3-5",
  "Numbers 28:6-10",
  "Numbers 28:11-16",
];

const ROSH_CHODESH_CHANUKAH = [
  "Numbers 28:1-5",
  "Numbers 28:6-10",
  "Numbers 28:11-16",
];

const FAST_DAYS = [
  "Exodus 32:11-14",
  "Exodus 34:1-3",
  "Exodus 34:4-10",
  "Isaiah 55:6-56:8",
];

const TISHA_BAV = [
  "Deuteronomy 4:25-4:29",
  "Deuteronomy 4:30-4:35",
  "Deuteronomy 4:36-4:40",
  "Jeremiah 8:13-9:23",
];

const PURIM = [
  "Exodus 17:8-10",
  "Exodus 17:11-13",
  "Exodus 17:14-16",
];

function merge(start: string, end: string): string {
  return start.slice(0, start.indexOf("-")) + end.slice(end.indexOf("-"));
}


function chanuka(date: JewishCalendar) {
  if (date.getDayOfChanukah() === 1) {
    return [
      "Numbers 7:1-11",
      "Numbers 7:12-14",
      "Numbers 7:15-17",
    ];
  } else if (date.getDayOfChanukah() === 2) {
    return [
      "Numbers 7:18-20",
      "Numbers 7:21-23",
      date.getInIsrael() ? "Numbers 7:18-23" : "Numbers 7:24-29",
    ];
  } else if (date.getDayOfChanukah() === 3) {
    return [
      "Numbers 7:24-26",
      "Numbers 7:27-29",
      date.getInIsrael() ? "Numbers 7:24-29" : "Numbers 7:30-35",
    ];
  } else if (date.getDayOfChanukah() === 4) {
    return [
      "Numbers 7:30-32",
      "Numbers 7:33-35",
      date.getInIsrael() ? "Numbers 7:30-35" : "Numbers 7:36-41",
    ];
  } else if (date.getDayOfChanukah() === 5) {
    return [
      "Numbers 7:36-38",
      "Numbers 7:39-41",
      date.getInIsrael() ? "Numbers 7:36-41" : "Numbers 7:42-47",
    ];
  } else if (date.getDayOfChanukah() === 6) {
    return ROSH_CHODESH_CHANUKAH.concat(["Numbers 7:42-47"]);
  } else if (date.getDayOfChanukah() === 7) {
    if (date.isRoshChodesh()) return ROSH_CHODESH_CHANUKAH.concat(["Numbers 7:48-53"]);
    return [
      "Numbers 7:48-50",
      "Numbers 7:51-53",
      date.getInIsrael() ? "Numbers 7:48-53" : "Numbers 7:54-59",
    ];
  } else {
    return [
      "Numbers 7:54-56",
      "Numbers 7:57-59",
      "Numbers 7:60-8:4",
    ];
  }
}

const PESACH_MAFTIR = ["Numbers 28:16-25"];
const PESACH: Record<number, string[]> = {
  16: [
    "Leviticus 22:26-23:8",
    "Leviticus 23:9-14",
    "Leviticus 23:15-44",
  ],
  17: [
    "Exodus 13:1-3",
    "Exodus 13:4-10",
    "Exodus 13:11-16",
  ],
  18: [
    "Exodus 22:24-26",
    "Exodus 22:27-23:5",
    "Exodus 23:6-19",
  ],
  19: [
    "Exodus 34:1-3",
    "Exodus 34:4-10",
    "Exodus 34:11-26",
  ],
  20: [
    "Numbers 9:1-5",
    "Numbers 9:6-8",
    "Numbers 9:8-14",
  ],
};

function pesach(date: JewishCalendar): string[] {
  return PESACH[date.getJewishDayOfMonth()].concat(PESACH_MAFTIR);
}

const SUKKOT: Record<number, string> = {
  2: "Numbers 29:17-19",
  3: "Numbers 29:20-22",
  4: "Numbers 29:23-25",
  5: "Numbers 29:26-28",
  6: "Numbers 29:29-31",
  7: "Numbers 29:32-34",
};

function sukkot(date: JewishCalendar): string[] {
  const dayOfSukkot = date.getJewishDayOfMonth() - 14;
  if (date.getInIsrael()) {
    return [1, 2, 3, 4].map(() => SUKKOT[dayOfSukkot]);
  }

  if (dayOfSukkot >= 3 && dayOfSukkot <= 6) {
    return [
      SUKKOT[dayOfSukkot - 1],
      SUKKOT[dayOfSukkot],
      SUKKOT[dayOfSukkot + 1],
      merge(SUKKOT[dayOfSukkot], SUKKOT[dayOfSukkot + 1]),
    ];
  }

  return [
    SUKKOT[5],
    SUKKOT[6],
    SUKKOT[7],
    merge(SUKKOT[6], SUKKOT[7]),
  ];
}

const REMAPPING: Record<string, string> = {
  "Bereshis": "Bereshit",
  "Toldos": "Toldot",
  "Shemos": "Shemot",
  "Yisro": "Yitro",
  "Ki Sisa": "Ki Tisa",
  "Achrei Mos": "Achrei Mot",
  "Achrei Mos Kedoshim": "Achrei Mot-Kedoshim",
  "Bechukosai": "Bechukotai",
  "Beha'aloscha": "Beha'alotcha",
  "Behar Bechukosai": "Behar-Bechukotai",
  "Chukas Balak": "Chukat-Balak",
  "Chukas": "Chukat",
  "Ki Savo": "Ki Tavo",
  "Ki Seitzei": "Ki Teitzei",
  "Matos Masei": "Matot-Masei",
  "Matos": "Matot",
  "Nitzavim Vayeilech": "Nitzavim-Vayeilech",
  "Tazria Metzora": "Tazria-Metzora",
  "Vaeschanan": "Vaetchanan",
  "Vayakhel Pekudei": "Vayakhel-Pekudei",
  "Vezos Habracha": "Vezot Habracha",
};

function nextShabbat(date: JewishCalendar): JewishCalendar {
  return new JewishCalendar(date.getDate().plus({days: 7 - date.getDayOfWeek()}));
}

export function getWeekdayReading(date: JewishCalendar): string[] {
  if (date.isChanukah()) {
    return chanuka(date);
  } else if (date.isCholHamoedPesach()) {
    return pesach(date);
  } else if (date.isCholHamoedSuccos()) {
    return sukkot(date);
  } else if (date.isTaanis()) {
    return date.getJewishMonth() === 5 ? TISHA_BAV : FAST_DAYS;
  } else if (date.isRoshChodesh()) {
    return ROSH_CHODESH;
  }
  const formatter = new HebrewDateFormatter();
  const maybePurim = formatter.formatYomTov(date);
  if (maybePurim === "Purim" || maybePurim === "Shushan Purim") {
    return PURIM;
  }

  if (date.getDayOfWeek() !== 2 && date.getDayOfWeek() !== 5) {
    return [];
  }
  for (let i = 0; i < 3; i++) {
    const parsha = formatter.formatParsha(nextShabbat(date));
    if (parsha !== "") {
      return ALIYOT[parsha in REMAPPING ? REMAPPING[parsha] : parsha];
    }
  }
  throw new Error(formatter.format(date));
}
