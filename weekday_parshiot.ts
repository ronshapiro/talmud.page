/* eslint-disable quote-props */
import {JewishCalendar, HebrewDateFormatter} from "kosher-zmanim";


const ALIYOT: Record<string, string[]> = {
  "Achrei Mot": [
    "Leviticus 16:1-16:6",
    "Leviticus 16:7-16:11",
    "Leviticus 16:12-16:17",
  ],
  "Achrei Mot-Kedoshim": [
    "Leviticus 16:1-16:6",
    "Leviticus 16:7-16:11",
    "Leviticus 16:12-16:17",
  ],
  "Balak": [
    "Numbers 22:2-22:4",
    "Numbers 22:5-22:7",
    "Numbers 22:8-22:12",
  ],
  "Bamidbar": [
    "Numbers 1:1-1:4",
    "Numbers 1:5-1:16",
    "Numbers 1:17-1:19",
  ],
  "Bechukotai": [
    "Leviticus 26:3-26:5",
    "Leviticus 26:6-26:9",
    "Leviticus 26:10-26:13",
  ],
  "Beha'alotcha": [
    "Numbers 8:1-8:4",
    "Numbers 8:5-8:9",
    "Numbers 8:10-8:14",
  ],
  "Behar": [
    "Leviticus 25:1-25:3",
    "Leviticus 25:4-25:7",
    "Leviticus 25:8-25:13",
  ],
  "Behar-Bechukotai": [
    "Leviticus 25:1-25:3",
    "Leviticus 25:4-25:7",
    "Leviticus 25:8-25:13",
  ],
  "Bereshit": [
    "Genesis 1:1-1:5",
    "Genesis 1:6-1:8",
    "Genesis 1:9-1:13",
  ],
  "Beshalach": [
    "Exodus 13:17-13:22",
    "Exodus 14:1-14:4",
    "Exodus 14:5-14:8",
  ],
  "Bo": [
    "Exodus 10:1-10:3",
    "Exodus 10:4-10:6",
    "Exodus 10:7-10:11",
  ],
  "Chayei Sara": [
    "Genesis 23:1-23:7",
    "Genesis 23:8-23:12",
    "Genesis 23:13-23:16",
  ],
  "Chukat": [
    "Numbers 19:1-19:6",
    "Numbers 19:7-19:9",
    "Numbers 19:10-19:17",
  ],
  "Chukat-Balak": [
    "Numbers 19:1-19:6",
    "Numbers 19:7-19:9",
    "Numbers 19:10-19:17",
  ],
  "Devarim": [
    "Deuteronomy 1:1-1:3",
    "Deuteronomy 1:4-1:7",
    "Deuteronomy 1:8-1:11",
  ],
  "Eikev": [
    "Deuteronomy 7:12-7:21",
    "Deuteronomy 7:22-8:3",
    "Deuteronomy 8:4-8:10",
  ],
  "Emor": [
    "Leviticus 21:1-21:6",
    "Leviticus 21:7-21:12",
    "Leviticus 21:13-21:15",
  ],
  "Ha'Azinu": [
    "Deuteronomy 32:1-32:3",
    "Deuteronomy 32:4-32:6",
    "Deuteronomy 32:7-32:12",
  ],
  "Kedoshim": [
    "Leviticus 19:1-19:4",
    "Leviticus 19:5-19:10",
    "Leviticus 19:11-19:14",
  ],
  "Ki Tavo": [
    "Deuteronomy 26:1-26:3",
    "Deuteronomy 26:4-26:11",
    "Deuteronomy 26:12-26:15",
  ],
  "Ki Teitzei": [
    "Deuteronomy 21:10-21:14",
    "Deuteronomy 21:15-21:17",
    "Deuteronomy 21:18-21:21",
  ],
  "Ki Tisa": [
    "Exodus 30:11-30:13",
    "Exodus 30:14-30:16",
    "Exodus 30:17-30:21",
  ],
  "Korach": [
    "Numbers 16:1-16:3",
    "Numbers 16:4-16:7",
    "Numbers 16:8-16:13",
  ],
  "Lech Lecha": [
    "Genesis 12:1-12:3",
    "Genesis 12:4-12:9",
    "Genesis 12:10-12:13",
  ],
  "Masei": [
    "Numbers 33:1-33:3",
    "Numbers 33:4-33:6",
    "Numbers 33:7-33:10",
  ],
  "Matot": [
    "Numbers 30:2-30:9",
    "Numbers 30:10-30:13",
    "Numbers 30:14-30:17",
  ],
  "Matot-Masei": [
    "Numbers 30:2-30:9",
    "Numbers 30:10-30:13",
    "Numbers 30:14-30:17",
  ],
  "Metzora": [
    "Leviticus 14:1-14:5",
    "Leviticus 14:6-14:9",
    "Leviticus 14:10-14:12",
  ],
  "Miketz": [
    "Genesis 41:1-41:4",
    "Genesis 41:5-41:7",
    "Genesis 41:8-41:14",
  ],
  "Mishpatim": [
    "Exodus 21:1-21:6",
    "Exodus 21:7-21:11",
    "Exodus 21:12-21:19",
  ],
  "Nasso": [
    "Numbers 4:21-4:24",
    "Numbers 4:25-4:28",
    "Numbers 4:29-4:33",
  ],
  "Nitzavim": [
    "Deuteronomy 29:9-29:11",
    "Deuteronomy 29:12-29:14",
    "Deuteronomy 29:15-29:28",
  ],
  "Nitzavim-Vayeilech": [
    "Deuteronomy 29:9-29:11",
    "Deuteronomy 29:12-29:14",
    "Deuteronomy 29:15-29:28",
  ],
  "Noach": [
    "Genesis 6:9-6:16",
    "Genesis 6:17-6:19",
    "Genesis 6:20-6:22",
  ],
  "Pekudei": [
    "Exodus 38:21-38:23",
    "Exodus 38:24-38:27",
    "Exodus 38:28-39:1",
  ],
  "Pinchas": [
    "Numbers 25:10-25:12",
    "Numbers 25:13-25:15",
    "Numbers 25:16-26:4",
  ],
  "Re'eh": [
    "Deuteronomy 11:26-11:31",
    "Deuteronomy 11:32-12:5",
    "Deuteronomy 12:6-12:10",
  ],
  "Sh'lach": [
    "Numbers 13:1-13:3",
    "Numbers 13:4-13:16",
    "Numbers 13:17-13:20",
  ],
  "Shemot": [
    "Exodus 1:1-1:7",
    "Exodus 1:8-1:12",
    "Exodus 1:13-1:17",
  ],
  "Shmini": [
    "Leviticus 9:1-9:6",
    "Leviticus 9:7-9:10",
    "Leviticus 9:11-9:16",
  ],
  "Shoftim": [
    "Deuteronomy 16:18-16:20",
    "Deuteronomy 16:21-17:10",
    "Deuteronomy 17:11-17:13",
  ],
  "Tazria": [
    "Leviticus 12:1-12:4",
    "Leviticus 12:5-12:8",
    "Leviticus 13:1-13:5",
  ],
  "Tazria-Metzora": [
    "Leviticus 12:1-12:4",
    "Leviticus 12:5-12:8",
    "Leviticus 13:1-13:5",
  ],
  "Terumah": [
    "Exodus 25:1-25:5",
    "Exodus 25:6-25:9",
    "Exodus 25:10-25:16",
  ],
  "Tetzaveh": [
    "Exodus 27:20-28:5",
    "Exodus 28:6-28:9",
    "Exodus 28:10-28:12",
  ],
  "Toldot": [
    "Genesis 25:19-25:22",
    "Genesis 25:23-25:26",
    "Genesis 25:27-26:5",
  ],
  "Tzav": [
    "Leviticus 6:1-6:3",
    "Leviticus 6:4-6:6",
    "Leviticus 6:7-6:11",
  ],
  "Vaera": [
    "Exodus 6:2-6:5",
    "Exodus 6:6-6:9",
    "Exodus 6:10-6:13",
  ],
  "Vaetchanan": [
    "Deuteronomy 3:23-3:25",
    "Deuteronomy 3:26-4:4",
    "Deuteronomy 4:5-4:8",
  ],
  "Vayakhel": [
    "Exodus 35:1-35:3",
    "Exodus 35:4-35:10",
    "Exodus 35:11-35:20",
  ],
  "Vayakhel-Pekudei": [
    "Exodus 35:1-35:3",
    "Exodus 35:4-35:10",
    "Exodus 35:11-35:20",
  ],
  "Vayechi": [
    "Genesis 47:28-47:31",
    "Genesis 48:1-48:3",
    "Genesis 48:4-48:9",
  ],
  "Vayeilech": [
    "Deuteronomy 31:1-31:3",
    "Deuteronomy 31:4-31:6",
    "Deuteronomy 31:7-31:13",
  ],
  "Vayera": [
    "Genesis 18:1-18:5",
    "Genesis 18:6-18:8",
    "Genesis 18:9-18:14",
  ],
  "Vayeshev": [
    "Genesis 37:1-37:3",
    "Genesis 37:4-37:7",
    "Genesis 37:8-37:11",
  ],
  "Vayetzei": [
    "Genesis 28:10-28:12",
    "Genesis 28:13-28:17",
    "Genesis 28:18-28:22",
  ],
  "Vayigash": [
    "Genesis 44:18-44:20",
    "Genesis 44:21-44:24",
    "Genesis 44:25-44:30",
  ],
  "Vayikra": [
    "Leviticus 1:1-1:4",
    "Leviticus 1:5-1:9",
    "Leviticus 1:10-1:13",
  ],
  "Vayishlach": [
    "Genesis 32:4-32:6",
    "Genesis 32:7-32:9",
    "Genesis 32:10-32:13",
  ],
  "Yitro": [
    "Exodus 18:1-18:4",
    "Exodus 18:5-18:8",
    "Exodus 18:9-18:12",
  ],
  "Vezot Habracha": [
    "Deuteronomy 33:1-33:7",
    "Deuteronomy 33:8-33:12",
    "Deuteronomy 33:13-33:17",
  ],
};

const ROSH_CHODESH = [
  "Numbers 28:1-28:3",
  "Numbers 28:3-28:5",
  "Numbers 28:6-28:10",
  "Numbers 28:11-28:16",
];

const ROSH_CHODESH_CHANUKAH = [
  "Numbers 28:1-28:5",
  "Numbers 28:6-28:10",
  "Numbers 28:11-28:16",
];

const FAST_DAYS = [
  "Exodus 32:11-32:14",
  "Exodus 34:1-32:3",
  "Exodus 34:4-32:10",
  "Isaiah 55:6-56-8",
];

const TISHA_BAV = [
  "Deuteronomy 4:25-4:29",
  "Deuteronomy 4:30-4:35",
  "Deuteronomy 4:36-4:40",
  "Jeremiah 8:13-9:23",
];

const PURIM = [
  "Exodus 17:8-17:10",
  "Exodus 17:11-17:13",
  "Exodus 17:14-17:16",
];

function merge(start: string, end: string): string {
  return start.slice(0, start.indexOf("-")) + end.slice(end.indexOf("-"));
}


function chanuka(date: JewishCalendar) {
  if (date.getDayOfChanukah() === 1) {
    return [
      "Numbers 7:1-7:11",
      "Numbers 7:12-7:14",
      "Numbers 7:15-7:17",
    ];
  } else if (date.getDayOfChanukah() === 2) {
    return [
      "Numbers 7:18-7:20",
      "Numbers 7:21-7:23",
      date.getInIsrael() ? "Numbers 7:18-7:23" : "Numbers 7:24-7:29",
    ];
  } else if (date.getDayOfChanukah() === 3) {
    return [
      "Numbers 7:24-7:26",
      "Numbers 7:27-7:29",
      date.getInIsrael() ? "Numbers 7:24-7:29" : "Numbers 7:30-7:35",
    ];
  } else if (date.getDayOfChanukah() === 4) {
    return [
      "Numbers 7:30-7:32",
      "Numbers 7:33-7:35",
      date.getInIsrael() ? "Numbers 7:30-7:35" : "Numbers 7:36-7:41",
    ];
  } else if (date.getDayOfChanukah() === 5) {
    return [
      "Numbers 7:36-7:38",
      "Numbers 7:39-7:41",
      date.getInIsrael() ? "Numbers 7:36-7:41" : "Numbers 7:42-7:47",
    ];
  } else if (date.getDayOfChanukah() === 6) {
    return ROSH_CHODESH_CHANUKAH.concat(["Numbers 7:42-7:47"]);
  } else if (date.getDayOfChanukah() === 7) {
    if (date.isRoshChodesh()) return ROSH_CHODESH_CHANUKAH.concat(["Numbers 7:48-7:53"]);
    return [
      "Numbers 7:48-7:50",
      "Numbers 7:51-7:53",
      date.getInIsrael() ? "Numbers 7:48-7:53" : "Numbers 7:54-7:59",
    ];
  } else {
    return [
      "Numbers 7:54-7:56",
      "Numbers 7:57-7:59",
      "Numbers 7:60-8:4",
    ];
  }
}

const PESACH_MAFTIR = ["Numbers 28:16-25"];
const PESACH: Record<number, string[]> = {
  16: [
    "Leviticus 22:26-23:8",
    "Leviticus 23:9-23:14",
    "Leviticus 23:15-23:44",
  ],
  17: [
    "Exodus 13:1-13:3",
    "Exodus 13:4-13:10",
    "Exodus 13:11-13:16",
  ],
  18: [
    "Exodus 22:24-22:26",
    "Exodus 22:27-23:5",
    "Exodus 23:6-23:19",
  ],
  19: [
    "Exodus 34:1-34:3",
    "Exodus 34:4-34:10",
    "Exodus 34:11-34:26",
  ],
  20: [
    "Numbers 9:1-9:5",
    "Numbers 9:6-9:8",
    "Numbers 9:8-9:14",
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

export function getTodaysReading(): string[] | undefined {
  const today = new JewishCalendar();
  if (today.isChanukah()) {
    return chanuka(today);
  } else if (today.isCholHamoedPesach()) {
    return pesach(today);
  } else if (today.isCholHamoedSuccos()) {
    return sukkot(today);
  } else if (today.isTaanis()) {
    return today.getJewishMonth() === 5 ? TISHA_BAV : FAST_DAYS;
  } else if (today.isRoshChodesh()) {
    return ROSH_CHODESH;
  }
  const formatter = new HebrewDateFormatter();
  const maybePurim = formatter.formatYomTov(today);
  if (maybePurim === "Purim" || maybePurim === "Shushan Purim") {
    return PURIM;
  }

  if (today.getDayOfWeek() !== 2 && today.getDayOfWeek() !== 5) {
    return undefined;
  }
  for (let i = 0; i < 3; i++) {
    const parsha = formatter.formatParsha(nextShabbat(today));
    if (parsha !== "") {
      return ALIYOT[parsha in REMAPPING ? REMAPPING[parsha] : parsha];
    }
  }
  throw new Error(formatter.format(today));
}
