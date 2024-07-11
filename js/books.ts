interface Book {
  start: string;
  end: string;
  isMasechet: boolean;
  hebrewName: string;
}

export const books: Record<string, Book> = {
  "Amos": {
    "end": "9",
    "hebrewName": "עמוס",
    "isMasechet": false,
    "start": "1"
  },
  "Arakhin": {
    "end": "34a",
    "hebrewName": "ערכין",
    "isMasechet": true,
    "start": "2a"
  },
  "Avodah Zarah": {
    "end": "76b",
    "hebrewName": "עבודה זרה",
    "isMasechet": true,
    "start": "2a"
  },
  "Bava Batra": {
    "end": "176b",
    "hebrewName": "בבא בתרא",
    "isMasechet": true,
    "start": "2a"
  },
  "Bava Kamma": {
    "end": "119b",
    "hebrewName": "בבא קמא",
    "isMasechet": true,
    "start": "2a"
  },
  "Bava Metzia": {
    "end": "119a",
    "hebrewName": "בבא מציעא",
    "isMasechet": true,
    "start": "2a"
  },
  "Beitzah": {
    "end": "40b",
    "hebrewName": "ביצה",
    "isMasechet": true,
    "start": "2a"
  },
  "Bekhorot": {
    "end": "61a",
    "hebrewName": "בכורות",
    "isMasechet": true,
    "start": "2a"
  },
  "Berakhot": {
    "end": "64a",
    "hebrewName": "ברכות",
    "isMasechet": true,
    "start": "2a"
  },
  "BirkatHamazon": {
    "end": "not used",
    "hebrewName": "ברכת המזון",
    "isMasechet": false,
    "start": "not used"
  },
  "Chagigah": {
    "end": "27a",
    "hebrewName": "חגיגה",
    "isMasechet": true,
    "start": "2a"
  },
  "Chullin": {
    "end": "142a",
    "hebrewName": "חולין",
    "isMasechet": true,
    "start": "2a"
  },
  "Daniel": {
    "end": "12",
    "hebrewName": "דניאל",
    "isMasechet": false,
    "start": "1"
  },
  "Deuteronomy": {
    "end": "34",
    "hebrewName": "דברים",
    "isMasechet": false,
    "start": "1"
  },
  "Ecclesiastes": {
    "end": "12",
    "hebrewName": "קהלת",
    "isMasechet": false,
    "start": "1"
  },
  "Eruvin": {
    "end": "105a",
    "hebrewName": "עירובין",
    "isMasechet": true,
    "start": "2a"
  },
  "Esther": {
    "end": "10",
    "hebrewName": "אסתר",
    "isMasechet": false,
    "start": "1"
  },
  "Exodus": {
    "end": "40",
    "hebrewName": "שמות",
    "isMasechet": false,
    "start": "1"
  },
  "Ezekiel": {
    "end": "48",
    "hebrewName": "יחזקאל",
    "isMasechet": false,
    "start": "1"
  },
  "Ezra": {
    "end": "10",
    "hebrewName": "עזרא",
    "isMasechet": false,
    "start": "1"
  },
  "Genesis": {
    "end": "50",
    "hebrewName": "בראשית",
    "isMasechet": false,
    "start": "1"
  },
  "Gittin": {
    "end": "90b",
    "hebrewName": "גיטין",
    "isMasechet": true,
    "start": "2a"
  },
  "Habakkuk": {
    "end": "3",
    "hebrewName": "חבקוק",
    "isMasechet": false,
    "start": "1"
  },
  "Haggai": {
    "end": "2",
    "hebrewName": "חגי",
    "isMasechet": false,
    "start": "1"
  },
  "Horayot": {
    "end": "14a",
    "hebrewName": "הוריות",
    "isMasechet": true,
    "start": "2a"
  },
  "Hosea": {
    "end": "14",
    "hebrewName": "הושע",
    "isMasechet": false,
    "start": "1"
  },
  "I Chronicles": {
    "end": "29",
    "hebrewName": "דברי הימים א",
    "isMasechet": false,
    "start": "1"
  },
  "I Kings": {
    "end": "22",
    "hebrewName": "מלכים א",
    "isMasechet": false,
    "start": "1"
  },
  "I Samuel": {
    "end": "31",
    "hebrewName": "שמואל א",
    "isMasechet": false,
    "start": "1"
  },
  "II Chronicles": {
    "end": "36",
    "hebrewName": "דברי הימים ב",
    "isMasechet": false,
    "start": "1"
  },
  "II Kings": {
    "end": "25",
    "hebrewName": "מלכים ב",
    "isMasechet": false,
    "start": "1"
  },
  "II Samuel": {
    "end": "24",
    "hebrewName": "שמואל ב",
    "isMasechet": false,
    "start": "1"
  },
  "Isaiah": {
    "end": "66",
    "hebrewName": "ישעיהו",
    "isMasechet": false,
    "start": "1"
  },
  "Jeremiah": {
    "end": "52",
    "hebrewName": "ירמיהו",
    "isMasechet": false,
    "start": "1"
  },
  "Job": {
    "end": "42",
    "hebrewName": "איוב",
    "isMasechet": false,
    "start": "1"
  },
  "Joel": {
    "end": "4",
    "hebrewName": "יואל",
    "isMasechet": false,
    "start": "1"
  },
  "Jonah": {
    "end": "4",
    "hebrewName": "יונה",
    "isMasechet": false,
    "start": "1"
  },
  "Joshua": {
    "end": "24",
    "hebrewName": "יהושע",
    "isMasechet": false,
    "start": "1"
  },
  "Judges": {
    "end": "21",
    "hebrewName": "שופטים",
    "isMasechet": false,
    "start": "1"
  },
  "Keritot": {
    "end": "28b",
    "hebrewName": "כריתות",
    "isMasechet": true,
    "start": "2a"
  },
  "Ketubot": {
    "end": "112b",
    "hebrewName": "כתובות",
    "isMasechet": true,
    "start": "2a"
  },
  "Kiddushin": {
    "end": "82b",
    "hebrewName": "קידושין",
    "isMasechet": true,
    "start": "2a"
  },
  "Lamentations": {
    "end": "5",
    "hebrewName": "איכה",
    "isMasechet": false,
    "start": "1"
  },
  "Leviticus": {
    "end": "27",
    "hebrewName": "ויקרא",
    "isMasechet": false,
    "start": "1"
  },
  "Makkot": {
    "end": "24b",
    "hebrewName": "מכות",
    "isMasechet": true,
    "start": "2a"
  },
  "Malachi": {
    "end": "3",
    "hebrewName": "מלאכי",
    "isMasechet": false,
    "start": "1"
  },
  "Megillah": {
    "end": "32a",
    "hebrewName": "מגילה",
    "isMasechet": true,
    "start": "2a"
  },
  "Meilah": {
    "end": "22a",
    "hebrewName": "מעילה",
    "isMasechet": true,
    "start": "2a"
  },
  "Menachot": {
    "end": "110a",
    "hebrewName": "מנחות",
    "isMasechet": true,
    "start": "2a"
  },
  "Micah": {
    "end": "7",
    "hebrewName": "מיכה",
    "isMasechet": false,
    "start": "1"
  },
  "Moed Katan": {
    "end": "29a",
    "hebrewName": "מועד קטן",
    "isMasechet": true,
    "start": "2a"
  },
  "Nahum": {
    "end": "3",
    "hebrewName": "נחום",
    "isMasechet": false,
    "start": "1"
  },
  "Nazir": {
    "end": "66b",
    "hebrewName": "נזיר",
    "isMasechet": true,
    "start": "2a"
  },
  "Nedarim": {
    "end": "91b",
    "hebrewName": "נדרים",
    "isMasechet": true,
    "start": "2a"
  },
  "Nehemiah": {
    "end": "13",
    "hebrewName": "נחמיה",
    "isMasechet": false,
    "start": "1"
  },
  "Niddah": {
    "end": "73a",
    "hebrewName": "נדה",
    "isMasechet": true,
    "start": "2a"
  },
  "Numbers": {
    "end": "36",
    "hebrewName": "במדבר",
    "isMasechet": false,
    "start": "1"
  },
  "Obadiah": {
    "end": "1",
    "hebrewName": "עובדיה",
    "isMasechet": false,
    "start": "1"
  },
  "Pesachim": {
    "end": "121b",
    "hebrewName": "פסחים",
    "isMasechet": true,
    "start": "2a"
  },
  "Proverbs": {
    "end": "31",
    "hebrewName": "משלי",
    "isMasechet": false,
    "start": "1"
  },
  "Psalms": {
    "end": "150",
    "hebrewName": "תהילים",
    "isMasechet": false,
    "start": "1"
  },
  "Rosh Hashanah": {
    "end": "35a",
    "hebrewName": "ראש השנה",
    "isMasechet": true,
    "start": "2a"
  },
  "Ruth": {
    "end": "4",
    "hebrewName": "רות",
    "isMasechet": false,
    "start": "1"
  },
  "Sanhedrin": {
    "end": "113b",
    "hebrewName": "סנהדרין",
    "isMasechet": true,
    "start": "2a"
  },
  "Shabbat": {
    "end": "157b",
    "hebrewName": "שבת",
    "isMasechet": true,
    "start": "2a"
  },
  "Shekalim": {
    "end": "22b",
    "hebrewName": "שקלים",
    "isMasechet": true,
    "start": "2a"
  },
  "Shevuot": {
    "end": "49b",
    "hebrewName": "שבועות",
    "isMasechet": true,
    "start": "2a"
  },
  "SiddurAshkenaz": {
    "end": "not used",
    "hebrewName": "סידור אשכנז",
    "isMasechet": false,
    "start": "not used"
  },
  "SiddurSefard": {
    "end": "not used",
    "hebrewName": "סידור ספרד",
    "isMasechet": false,
    "start": "not used"
  },
  "Song of Songs": {
    "end": "8",
    "hebrewName": "שיר השירים",
    "isMasechet": false,
    "start": "1"
  },
  "Sotah": {
    "end": "49b",
    "hebrewName": "סוטה",
    "isMasechet": true,
    "start": "2a"
  },
  "Sukkah": {
    "end": "56b",
    "hebrewName": "סוכה",
    "isMasechet": true,
    "start": "2a"
  },
  "Taanit": {
    "end": "31a",
    "hebrewName": "תענית",
    "isMasechet": true,
    "start": "2a"
  },
  "Tamid": {
    "end": "33b",
    "hebrewName": "תמיד",
    "isMasechet": true,
    "start": "25b"
  },
  "Temurah": {
    "end": "34a",
    "hebrewName": "תמורה",
    "isMasechet": true,
    "start": "2a"
  },
  "Yevamot": {
    "end": "122b",
    "hebrewName": "יבמות",
    "isMasechet": true,
    "start": "2a"
  },
  "Yoma": {
    "end": "88a",
    "hebrewName": "יומא",
    "isMasechet": true,
    "start": "2a"
  },
  "Zechariah": {
    "end": "14",
    "hebrewName": "זכריה",
    "isMasechet": false,
    "start": "1"
  },
  "Zephaniah": {
    "end": "3",
    "hebrewName": "צפניה",
    "isMasechet": false,
    "start": "1"
  },
  "Zevachim": {
    "end": "120b",
    "hebrewName": "זבחים",
    "isMasechet": true,
    "start": "2a"
  },
  "Mishnah Berakhot": {
    "hebrewName": "משנה ברכות",
    "start": "1",
    "end": "9",
    "isMasechet": false,
  },
  "Mishnah Peah": {
    "hebrewName": "משנה פאה",
    "start": "1",
    "end": "8",
    "isMasechet": false,
  },
  "Mishnah Demai": {
    "hebrewName": "משנה דמאי",
    "start": "1",
    "end": "7",
    "isMasechet": false,
  },
  "Mishnah Kilayim": {
    "hebrewName": "משנה כלאים",
    "start": "1",
    "end": "9",
    "isMasechet": false,
  },
  "Mishnah Sheviit": {
    "hebrewName": "משנה שביעית",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Terumot": {
    "hebrewName": "משנה תרומות",
    "start": "1",
    "end": "11",
    "isMasechet": false,
  },
  "Mishnah Maasrot": {
    "hebrewName": "משנה מעשרות",
    "start": "1",
    "end": "5",
    "isMasechet": false,
  },
  "Mishnah Maaser Sheni": {
    "hebrewName": "משנה מעשר שני",
    "start": "1",
    "end": "5",
    "isMasechet": false,
  },
  "Mishnah Challah": {
    "hebrewName": "משנה חלה",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Orlah": {
    "hebrewName": "משנה ערלה",
    "start": "1",
    "end": "3",
    "isMasechet": false,
  },
  "Mishnah Bikkurim": {
    "hebrewName": "משנה ביכורים",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Shabbat": {
    "hebrewName": "משנה שבת",
    "start": "1",
    "end": "24",
    "isMasechet": false,
  },
  "Mishnah Eruvin": {
    "hebrewName": "משנה עירובין",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Pesachim": {
    "hebrewName": "משנה פסחים",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Shekalim": {
    "hebrewName": "משנה שקלים",
    "start": "1",
    "end": "8",
    "isMasechet": false,
  },
  "Mishnah Yoma": {
    "hebrewName": "משנה יומא",
    "start": "1",
    "end": "8",
    "isMasechet": false,
  },
  "Mishnah Sukkah": {
    "hebrewName": "משנה סוכה",
    "start": "1",
    "end": "5",
    "isMasechet": false,
  },
  "Mishnah Beitzah": {
    "hebrewName": "משנה ביצה",
    "start": "1",
    "end": "5",
    "isMasechet": false,
  },
  "Mishnah Rosh Hashanah": {
    "hebrewName": "משנה ראש השנה",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Ta'anit": {
    "hebrewName": "משנה תענית",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Megillah": {
    "hebrewName": "משנה מגילה",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Moed Katan": {
    "hebrewName": "משנה מועד קטן",
    "start": "1",
    "end": "3",
    "isMasechet": false,
  },
  "Mishnah Chagigah": {
    "hebrewName": "משנה חגיגה",
    "start": "1",
    "end": "3",
    "isMasechet": false,
  },
  "Mishnah Yevamot": {
    "hebrewName": "משנה יבמות",
    "start": "1",
    "end": "16",
    "isMasechet": false,
  },
  "Mishnah Ketubot": {
    "hebrewName": "משנה כתובות",
    "start": "1",
    "end": "13",
    "isMasechet": false,
  },
  "Mishnah Nedarim": {
    "hebrewName": "משנה נדרים",
    "start": "1",
    "end": "11",
    "isMasechet": false,
  },
  "Mishnah Nazir": {
    "hebrewName": "משנה נזיר",
    "start": "1",
    "end": "9",
    "isMasechet": false,
  },
  "Mishnah Sotah": {
    "hebrewName": "משנה סוטה",
    "start": "1",
    "end": "9",
    "isMasechet": false,
  },
  "Mishnah Gittin": {
    "hebrewName": "משנה גיטין",
    "start": "1",
    "end": "9",
    "isMasechet": false,
  },
  "Mishnah Kiddushin": {
    "hebrewName": "משנה קידושין",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Bava Kamma": {
    "hebrewName": "משנה בבא קמא",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Bava Metzia": {
    "hebrewName": "משנה בבא מציעא",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Bava Batra": {
    "hebrewName": "משנה בבא בתרא",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Sanhedrin": {
    "hebrewName": "משנה סנהדרין",
    "start": "1",
    "end": "11",
    "isMasechet": false,
  },
  "Mishnah Makkot": {
    "hebrewName": "משנה מכות",
    "start": "1",
    "end": "3",
    "isMasechet": false,
  },
  "Mishnah Shevuot": {
    "hebrewName": "משנה שבועות",
    "start": "1",
    "end": "8",
    "isMasechet": false,
  },
  "Mishnah Eduyot": {
    "hebrewName": "משנה עדיות",
    "start": "1",
    "end": "8",
    "isMasechet": false,
  },
  "Mishnah Avodah Zarah": {
    "hebrewName": "משנה עבודה זרה",
    "start": "1",
    "end": "5",
    "isMasechet": false,
  },
  "Pirkei Avot": {
    "hebrewName": "משנה אבות",
    "start": "1",
    "end": "6",
    "isMasechet": false,
  },
  "Mishnah Horayot": {
    "hebrewName": "משנה הוריות",
    "start": "1",
    "end": "3",
    "isMasechet": false,
  },
  "Mishnah Zevachim": {
    "hebrewName": "משנה זבחים",
    "start": "1",
    "end": "14",
    "isMasechet": false,
  },
  "Mishnah Menachot": {
    "hebrewName": "משנה מנחות",
    "start": "1",
    "end": "13",
    "isMasechet": false,
  },
  "Mishnah Chullin": {
    "hebrewName": "משנה חולין",
    "start": "1",
    "end": "12",
    "isMasechet": false,
  },
  "Mishnah Bekhorot": {
    "hebrewName": "משנה בכורות",
    "start": "1",
    "end": "9",
    "isMasechet": false,
  },
  "Mishnah Arakhin": {
    "hebrewName": "משנה ערכין",
    "start": "1",
    "end": "9",
    "isMasechet": false,
  },
  "Mishnah Temurah": {
    "hebrewName": "משנה תמורה",
    "start": "1",
    "end": "7",
    "isMasechet": false,
  },
  "Mishnah Keritot": {
    "hebrewName": "משנה כריתות",
    "start": "1",
    "end": "6",
    "isMasechet": false,
  },
  "Mishnah Meilah": {
    "hebrewName": "משנה מעילה",
    "start": "1",
    "end": "6",
    "isMasechet": false,
  },
  "Mishnah Tamid": {
    "hebrewName": "משנה תמיד",
    "start": "1",
    "end": "7",
    "isMasechet": false,
  },
  "Mishnah Middot": {
    "hebrewName": "משנה מדות",
    "start": "1",
    "end": "5",
    "isMasechet": false,
  },
  "Mishnah Kinnim": {
    "hebrewName": "משנה קינים",
    "start": "1",
    "end": "3",
    "isMasechet": false,
  },
  "Mishnah Kelim": {
    "hebrewName": "משנה כלים",
    "start": "1",
    "end": "30",
    "isMasechet": false,
  },
  "Mishnah Oholot": {
    "hebrewName": "משנה אהלות",
    "start": "1",
    "end": "18",
    "isMasechet": false,
  },
  "Mishnah Negaim": {
    "hebrewName": "משנה נגעים",
    "start": "1",
    "end": "14",
    "isMasechet": false,
  },
  "Mishnah Parah": {
    "hebrewName": "משנה פרה",
    "start": "1",
    "end": "12",
    "isMasechet": false,
  },
  "Mishnah Tahorot": {
    "hebrewName": "משנה טהרות",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Mikvaot": {
    "hebrewName": "משנה מקואות",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Niddah": {
    "hebrewName": "משנה נדה",
    "start": "1",
    "end": "10",
    "isMasechet": false,
  },
  "Mishnah Makhshirin": {
    "hebrewName": "משנה מכשירין",
    "start": "1",
    "end": "6",
    "isMasechet": false,
  },
  "Mishnah Zavim": {
    "hebrewName": "משנה זבים",
    "start": "1",
    "end": "5",
    "isMasechet": false,
  },
  "Mishnah Tevul Yom": {
    "hebrewName": "משנה טבול יום",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Yadayim": {
    "hebrewName": "משנה ידים",
    "start": "1",
    "end": "4",
    "isMasechet": false,
  },
  "Mishnah Oktzin": {
    "hebrewName": "משנה עוקצים",
    "start": "1",
    "end": "3",
    "isMasechet": false,
  },
};
