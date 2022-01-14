export interface CommentaryType {
  englishName: string;
  englishNamePattern?: RegExp;
  hebrewName: string;
  className: string;
  showTitle?: boolean;
  cssCategory?: string;
  category?: string;
  type?: string;
  refPattern?: RegExp;
  allowNestedTraversals?: true;
}

export const ALL_COMMENTARIES: CommentaryType[] = [
  {
    englishName: "Translation",
    hebrewName: "Translation",
    className: "translation",
  },
  {
    englishName: "Explanation",
    hebrewName: "הכנות",
    className: "explanation",
  },
  {
    englishName: "Footnotes",
    hebrewName: "הערות",
    className: "tp-footnote",
  },
  {
    englishName: "Verses",
    category: "Tanakh",
    hebrewName: 'תנ"ך',
    className: "psukim",
    showTitle: true,
  },
  {
    englishName: "Mishnah",
    category: "Mishnah",
    hebrewName: "משנה",
    className: "mishna",
    showTitle: true,
  },
  {
    englishName: "Tosefta",
    englishNamePattern: /^Tosefta .*/,
    hebrewName: "תוספתא",
    className: "tosefta",
    showTitle: true,
  },
  {
    englishName: "Rashi",
    hebrewName: 'רש"י',
    className: "rashi",
    allowNestedTraversals: true,
  },
  {
    englishName: "Otzar Laazei Rashi",
    hebrewName: 'אוצר לעזי רש"י',
    className: "otzar-laazei-rashi",
  },
  {
    englishName: "Tosafot",
    hebrewName: "תוספות",
    className: "tosafot",
    allowNestedTraversals: true,
  },
  {
    englishName: "Korban HaEdah",
    hebrewName: "קרבן העדה",
    className: "korban-haedah",
    allowNestedTraversals: true,
  },
  {
    englishName: "Penei Moshe",
    hebrewName: "פני משה",
    className: "penei-moshe",
    allowNestedTraversals: true,
  },
  {
    englishName: "Rabbeinu Chananel",
    englishNamePattern: /^Rabbeinu Chananel on .*/,
    hebrewName: 'ר"ח',
    className: "rabbeinu-chananel",
  },
  {
    englishName: "Ramban",
    hebrewName: 'רמב"ן',
    className: "ramban",
  },
  {
    englishName: "Rashba",
    hebrewName: 'רשב"א',
    className: "rashba",
  },
  {
    englishName: "Rashbam",
    hebrewName: 'רשב"ם',
    className: "rashbam",
  },
  {
    englishName: "Maharsha",
    englishNamePattern: /(Chidushei Halachot|Chidushei Agadot)/,
    hebrewName: 'מהרש"א',
    className: "maharsha",
  },
  {
    englishName: "Maharshal",
    englishNamePattern: /(Chokhmat Shlomo on .*|Chokhmat Shlomo)/,
    hebrewName: 'מהרש"ל',
    className: "maharshal",
  },
  {
    englishName: "Meir Lublin",
    englishNamePattern: /^Maharam$/,
    hebrewName: 'מהר"ם לובלין',
    className: "meir-lublin",
  },
  {
    englishName: "Rosh",
    englishNamePattern: /^Rosh on /,
    hebrewName: 'רא"ש',
    className: "rosh",
  },
  {
    englishName: "Ritva",
    hebrewName: 'ריטב"א',
    className: "ritva",
  },
  {
    englishName: "Rav Nissim Gaon",
    englishNamePattern: /^Rav Nissim Gaon on /,
    hebrewName: "רבנו נסים",
    className: "rav-nissim-gaon",
  },
  {
    englishName: "Gilyon HaShas",
    hebrewName: 'גליון הש"ס',
    className: "gilyon-hashas",
  },
  {
    englishName: "Shulchan Arukh",
    englishNamePattern: /^Shulchan Arukh, /,
    hebrewName: "שולחן ערוך",
    className: "shulchan-arukh",
    cssCategory: "ein-mishpat",
    showTitle: true,
    allowNestedTraversals: true,
  },
  {
    englishName: "Mishnah Berurah",
    hebrewName: "משנה ברורה",
    className: "mishnah-berura",
    cssCategory: "ein-mishpat",
  },
  {
    englishName: "Mishneh Torah",
    englishNamePattern: /^Mishneh Torah, /,
    hebrewName: "משנה תורה",
    className: "mishneh-torah",
    cssCategory: "ein-mishpat",
    showTitle: true,
  },
  {
    englishName: "Mesorat Hashas",
    type: "mesorat hashas",
    hebrewName: 'מסורת הש"ס',
    className: "mesorat-hashas",
    showTitle: true,
  },
  {
    englishName: "Jastrow",
    hebrewName: "Jastrow",
    className: "jastrow",
  },
  {
    englishName: "Abarbanel",
    englishNamePattern: /^Abarbanel on/,
    hebrewName: "אברבנאל",
    className: "abarbanel",
  },
  {
    englishName: "Guide for the Perplexed",
    hebrewName: "מורה נבוכים",
    className: "guide-perplexed",
  },
  {
    englishName: "Haamek Davar",
    englishNamePattern: /^Haamek Davar on/,
    hebrewName: "העמק דבר",
    className: "haamek-davar",
  },
  {
    englishName: "Ibn Ezra",
    englishNamePattern: /^Ibn Ezra on /,
    hebrewName: "אבן עזרא",
    className: "ibn-ezra",
  },
  {
    englishName: "JPS 1985 Footnotes",
    hebrewName: "JPS Footnotes",
    className: "jps-1985",
  },
  {
    englishName: "Kedushat Levi",
    englishNamePattern: /^Kedushat Levi, /,
    hebrewName: "קדושת לוי",
    className: "kedushat-levi",
  },
  {
    englishName: "Kli Yakar",
    englishNamePattern: /^Kli Yakar on /,
    hebrewName: "כלי יקר",
    className: "kli-yakar",
  },
  {
    englishName: "Malbim",
    englishNamePattern: /^Malbim on /,
    hebrewName: 'מלבי"ם',
    className: "malbim",
  },
  {
    englishName: "Mei HaShiloach",
    hebrewName: "מי השלוח",
    className: "mei-hashiloach",
  },
  {
    englishName: "Meshech Hochma",
    hebrewName: "משך חכמה",
    className: "meshech-hochma",
  },
  {
    englishName: "Radak",
    englishNamePattern: /^Radak on /,
    hebrewName: 'רד"ק',
    className: "radak",
  },
  {
    englishName: "Sefer HaChinukh",
    hebrewName: "ספר החינוך",
    className: "sefer-hachinukh",
  },
  {
    englishName: "Sforno",
    englishNamePattern: /^Sforno on /,
    hebrewName: "ספורנו",
    className: "sforno",
  },
  {
    englishName: "Torah Temima",
    englishNamePattern: /^Torah Temimah on /,
    hebrewName: "תורה תמימה",
    className: "torah-temima",
  },
  {
    englishName: "Steinsaltz Masechet Intro",
    refPattern: /^Introductions to the Babylonian Talmud, (.*), Introduction to \1 .*/,
    hebrewName: "הקדמה למסכת",
    className: "steinsaltz-masechet-intro",
  },
  {
    englishName: "Steinsaltz Perek Intro",
    refPattern: /^Introductions to the Babylonian Talmud, .*, Introduction to Perek .*/,
    hebrewName: "הקדמה לפרק",
    className: "steinsaltz-perek-intro",
  },
  {
    englishName: "Steinsaltz Perek Summary",
    refPattern: /^Introductions to the Babylonian Talmud, .*, Summary of Perek .*/,
    hebrewName: "סיכום לפרק",
    className: "steinsaltz-perek-summary",
  },
  {
    englishName: "Steinsaltz",
    hebrewName: "שטיינזלץ",
    className: "translation",
  },
];
