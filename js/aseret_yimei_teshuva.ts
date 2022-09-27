import {range} from "underscore";

export const ASERET_YIMEI_TESHUVA_REFS: Set<string> = new Set([
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs 4",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs 5",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 8",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 3",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 3",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 10",
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Peace 2",
  "Siddur Sefard, Weekday Shacharit, Amidah 17",
  "Siddur Sefard, Weekday Shacharit, Amidah 68",
  "Siddur Sefard, Weekday Shacharit, Amidah 119",
].concat(
  range(1, 9).map(x => `Psalms 130:${x}`),
));
