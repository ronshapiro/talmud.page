interface CommentaryType {
  englishName: string;
  hebrewName: string;
  className: string;
  showTitle?: boolean;
  cssCategory?: string;
  type?: string;
}

const COMMENTARY_TYPES: CommentaryType[] = [
  {
    englishName: "Translation",
    hebrewName: "Translation",
    className: "translation",
  },
  {
    englishName: "Verses",
    hebrewName: 'תנ״ך',
    className: "psukim",
    showTitle: true,
  },
  {
    englishName: "Mishnah",
    hebrewName: "משנה",
    className: "mishna",
    showTitle: true,
  },
  {
    englishName: "Tosefta",
    hebrewName: "תוספתא",
    className: "tosefta",
    showTitle: true,
  },
  {
    englishName: "Rashi",
    hebrewName: 'רש"י',
    className: "rashi",
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
  },
  {
    englishName: "Rabbeinu Chananel",
    hebrewName: 'ר"ח',
    className: "rabbeinu-chananel",
  },
  {
    englishName: "Ramban",
    hebrewName: 'רמב״ן',
    className: "ramban",
  },
  {
    englishName: "Rashba",
    hebrewName: 'רשב״א',
    className: "rashba",
  },
  {
    englishName: "Rashbam",
    hebrewName: 'רשב״ם',
    className: "rashbam",
  },
  {
    englishName: "Maharsha",
    hebrewName: 'מהרש"א',
    className: "maharsha",
  },
  {
    englishName: "Maharshal",
    hebrewName: 'מהרש"ל',
    className: "maharshal",
  },
  {
    englishName: "Meir Lublin",
    hebrewName: 'מהר"ם לובלין',
    className: "meir-lublin",
  },
  {
    englishName: "Rosh",
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
    hebrewName: "רבנו נסים",
    className: "rav-nissim-gaon",
  },
  {
    englishName: "Shulchan Arukh",
    hebrewName: "שולחן ערוך",
    className: "shulchan-arukh",
    cssCategory: "ein-mishpat",
    showTitle: true,
  },
  {
    englishName: "Mishneh Torah",
    hebrewName: "משנה תורה",
    className: "mishneh-torah",
    cssCategory: "ein-mishpat",
    showTitle: true,
  },
  {
    englishName: "Mesorat Hashas",
    type: "mesorat hashas",
    hebrewName: 'מסורת הש״ס',
    className: "mesorat-hashas",
    showTitle: true,
  },
  {
    englishName: "Jastrow",
    hebrewName: "Jastrow",
    className: "jastrow",
  },
];

const STEINSALTZ = {
  englishName: "steinsaltz",
  hebrewName: "שטיינזלץ",
  className: "translation",
};


export function getCommentaryTypes(resourceType: "tanakh" | "talmud"): CommentaryType[] {
  const types = [...COMMENTARY_TYPES];
  if (resourceType === "talmud") {
    if (localStorage.showTranslationButton === "yes") {
      types.push(STEINSALTZ);
    } else {
      types.unshift(STEINSALTZ);
    }
  }
  types.push({
    englishName: "Personal Notes",
    hebrewName: "Personal Notes",
    className: "personal-notes",
  });

  return types;
}
