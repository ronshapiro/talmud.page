export interface CommentaryType {
  englishName: string;
  hebrewName: string;
  className: string;
  showTitle?: boolean;
  cssCategory?: string;
  type?: string;
}

export const MASTER_COMMENTARY_TYPES: CommentaryType[] = [
  {
    "className": "translation",
    "englishName": "Translation",
    "hebrewName": "Translation"
  },
  {
    "className": "psukim",
    "englishName": "Verses",
    "hebrewName": "תנ\"ך",
    "showTitle": true
  },
  {
    "className": "mishna",
    "englishName": "Mishnah",
    "hebrewName": "משנה",
    "showTitle": true
  },
  {
    "className": "tosefta",
    "englishName": "Tosefta",
    "hebrewName": "תוספתא",
    "showTitle": true
  },
  {
    "className": "rashi",
    "englishName": "Rashi",
    "hebrewName": "רש\"י"
  },
  {
    "className": "otzar-laazei-rashi",
    "englishName": "Otzar Laazei Rashi",
    "hebrewName": "אוצר לעזי רש\"י"
  },
  {
    "className": "tosafot",
    "englishName": "Tosafot",
    "hebrewName": "תוספות"
  },
  {
    "className": "rabbeinu-chananel",
    "englishName": "Rabbeinu Chananel",
    "hebrewName": "ר\"ח"
  },
  {
    "className": "ramban",
    "englishName": "Ramban",
    "hebrewName": "רמב\"ן"
  },
  {
    "className": "rashba",
    "englishName": "Rashba",
    "hebrewName": "רשב\"א"
  },
  {
    "className": "rashbam",
    "englishName": "Rashbam",
    "hebrewName": "רשב\"ם"
  },
  {
    "className": "maharsha",
    "englishName": "Maharsha",
    "hebrewName": "מהרש\"א"
  },
  {
    "className": "maharshal",
    "englishName": "Maharshal",
    "hebrewName": "מהרש\"ל"
  },
  {
    "className": "meir-lublin",
    "englishName": "Meir Lublin",
    "hebrewName": "מהר\"ם לובלין"
  },
  {
    "className": "rosh",
    "englishName": "Rosh",
    "hebrewName": "רא\"ש"
  },
  {
    "className": "ritva",
    "englishName": "Ritva",
    "hebrewName": "ריטב\"א"
  },
  {
    "className": "rav-nissim-gaon",
    "englishName": "Rav Nissim Gaon",
    "hebrewName": "רבנו נסים"
  },
  {
    "className": "shulchan-arukh",
    "cssCategory": "ein-mishpat",
    "englishName": "Shulchan Arukh",
    "hebrewName": "שולחן ערוך",
    "showTitle": true
  },
  {
    "className": "mishneh-torah",
    "cssCategory": "ein-mishpat",
    "englishName": "Mishneh Torah",
    "hebrewName": "משנה תורה",
    "showTitle": true
  },
  {
    "className": "mesorat-hashas",
    "englishName": "Mesorat Hashas",
    "hebrewName": "מסורת הש\"ס",
    "showTitle": true,
    "type": "mesorat hashas"
  },
  {
    "className": "jastrow",
    "englishName": "Jastrow",
    "hebrewName": "Jastrow"
  },
  {
    "className": "abarbanel",
    "englishName": "Abarbanel",
    "hebrewName": "אברבנאל"
  },
  {
    "className": "guide-perplexed",
    "englishName": "Guide for the Perplexed",
    "hebrewName": "מורה נבוכים"
  },
  {
    "className": "haamek-davar",
    "englishName": "Haamek Davar",
    "hebrewName": "העמק דבר"
  },
  {
    "className": "ibn-ezra",
    "englishName": "Ibn Ezra",
    "hebrewName": "אבן עזרא"
  },
  {
    "className": "jps-1985",
    "englishName": "JPS 1985 Footnotes",
    "hebrewName": "JPS Footnotes"
  },
  {
    "className": "kedushat-levi",
    "englishName": "Kedushat Levi",
    "hebrewName": "קדושת לוי"
  },
  {
    "className": "kli-yakar",
    "englishName": "Kli Yakar",
    "hebrewName": "כלי יקר"
  },
  {
    "className": "malbim",
    "englishName": "Malbim",
    "hebrewName": "מלבי\"ם"
  },
  {
    "className": "mei-hashiloach",
    "englishName": "Mei HaShiloach",
    "hebrewName": "מי השלוח"
  },
  {
    "className": "meshech-hochma",
    "englishName": "Meshech Hochma",
    "hebrewName": "משך חכמה"
  },
  {
    "className": "radak",
    "englishName": "Radak",
    "hebrewName": "רד\"ק"
  },
  {
    "className": "sefer-hachinukh",
    "englishName": "Sefer HaChinukh",
    "hebrewName": "ספר החינוך"
  },
  {
    "className": "sforno",
    "englishName": "Sforno",
    "hebrewName": "ספורנו"
  },
  {
    "className": "torah-temima",
    "englishName": "Torah Temima",
    "hebrewName": "תורה תמימה"
  },
  {
    "className": "translation",
    "englishName": "Steinsaltz",
    "hebrewName": "שטיינזלץ"
  }
];
