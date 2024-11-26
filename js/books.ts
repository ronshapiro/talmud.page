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
    "end": "Birkat Hamazon",
    "hebrewName": "ברכת המזון",
    "isMasechet": false,
    "start": "Shir Hama'alot"
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
  "Mishnah Arakhin": {
    "end": "9",
    "hebrewName": "משנה ערכין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Avodah Zarah": {
    "end": "5",
    "hebrewName": "משנה עבודה זרה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Bava Batra": {
    "end": "10",
    "hebrewName": "משנה בבא בתרא",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Bava Kamma": {
    "end": "10",
    "hebrewName": "משנה בבא קמא",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Bava Metzia": {
    "end": "10",
    "hebrewName": "משנה בבא מציעא",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Beitzah": {
    "end": "5",
    "hebrewName": "משנה ביצה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Bekhorot": {
    "end": "9",
    "hebrewName": "משנה בכורות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Berakhot": {
    "end": "9",
    "hebrewName": "משנה ברכות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Bikkurim": {
    "end": "4",
    "hebrewName": "משנה ביכורים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Chagigah": {
    "end": "3",
    "hebrewName": "משנה חגיגה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Challah": {
    "end": "4",
    "hebrewName": "משנה חלה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Chullin": {
    "end": "12",
    "hebrewName": "משנה חולין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Demai": {
    "end": "7",
    "hebrewName": "משנה דמאי",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Eduyot": {
    "end": "8",
    "hebrewName": "משנה עדיות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Eruvin": {
    "end": "10",
    "hebrewName": "משנה עירובין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Gittin": {
    "end": "9",
    "hebrewName": "משנה גיטין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Horayot": {
    "end": "3",
    "hebrewName": "משנה הוריות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Kelim": {
    "end": "30",
    "hebrewName": "משנה כלים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Keritot": {
    "end": "6",
    "hebrewName": "משנה כריתות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Ketubot": {
    "end": "13",
    "hebrewName": "משנה כתובות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Kiddushin": {
    "end": "4",
    "hebrewName": "משנה קידושין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Kilayim": {
    "end": "9",
    "hebrewName": "משנה כלאים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Kinnim": {
    "end": "3",
    "hebrewName": "משנה קינים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Maaser Sheni": {
    "end": "5",
    "hebrewName": "משנה מעשר שני",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Maasrot": {
    "end": "5",
    "hebrewName": "משנה מעשרות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Makhshirin": {
    "end": "6",
    "hebrewName": "משנה מכשירין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Makkot": {
    "end": "3",
    "hebrewName": "משנה מכות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Megillah": {
    "end": "4",
    "hebrewName": "משנה מגילה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Meilah": {
    "end": "6",
    "hebrewName": "משנה מעילה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Menachot": {
    "end": "13",
    "hebrewName": "משנה מנחות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Middot": {
    "end": "5",
    "hebrewName": "משנה מדות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Mikvaot": {
    "end": "10",
    "hebrewName": "משנה מקואות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Moed Katan": {
    "end": "3",
    "hebrewName": "משנה מועד קטן",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Nazir": {
    "end": "9",
    "hebrewName": "משנה נזיר",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Nedarim": {
    "end": "11",
    "hebrewName": "משנה נדרים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Negaim": {
    "end": "14",
    "hebrewName": "משנה נגעים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Niddah": {
    "end": "10",
    "hebrewName": "משנה נדה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Oholot": {
    "end": "18",
    "hebrewName": "משנה אהלות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Oktzin": {
    "end": "3",
    "hebrewName": "משנה עוקצים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Orlah": {
    "end": "3",
    "hebrewName": "משנה ערלה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Parah": {
    "end": "12",
    "hebrewName": "משנה פרה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Peah": {
    "end": "8",
    "hebrewName": "משנה פאה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Pesachim": {
    "end": "10",
    "hebrewName": "משנה פסחים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Rosh Hashanah": {
    "end": "4",
    "hebrewName": "משנה ראש השנה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Sanhedrin": {
    "end": "11",
    "hebrewName": "משנה סנהדרין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Shabbat": {
    "end": "24",
    "hebrewName": "משנה שבת",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Shekalim": {
    "end": "8",
    "hebrewName": "משנה שקלים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Sheviit": {
    "end": "10",
    "hebrewName": "משנה שביעית",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Shevuot": {
    "end": "8",
    "hebrewName": "משנה שבועות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Sotah": {
    "end": "9",
    "hebrewName": "משנה סוטה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Sukkah": {
    "end": "5",
    "hebrewName": "משנה סוכה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Ta'anit": {
    "end": "4",
    "hebrewName": "משנה תענית",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Tahorot": {
    "end": "10",
    "hebrewName": "משנה טהרות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Tamid": {
    "end": "7",
    "hebrewName": "משנה תמיד",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Temurah": {
    "end": "7",
    "hebrewName": "משנה תמורה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Terumot": {
    "end": "11",
    "hebrewName": "משנה תרומות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Tevul Yom": {
    "end": "4",
    "hebrewName": "משנה טבול יום",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Yadayim": {
    "end": "4",
    "hebrewName": "משנה ידים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Yevamot": {
    "end": "16",
    "hebrewName": "משנה יבמות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Yoma": {
    "end": "8",
    "hebrewName": "משנה יומא",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Zavim": {
    "end": "5",
    "hebrewName": "משנה זבים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishnah Zevachim": {
    "end": "14",
    "hebrewName": "משנה זבחים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Admission into the Sanctuary": {
    "end": "9",
    "hebrewName": "משנה תורה, הלכות ביאת מקדש",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Agents and Partners": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות שלוחין ושותפין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Appraisals and Devoted Property": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות ערכים וחרמין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Blessings": {
    "end": "11",
    "hebrewName": "משנה תורה, הלכות ברכות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Borrowing and Deposit": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות שאלה ופיקדון",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Circumcision": {
    "end": "3",
    "hebrewName": "משנה תורה, הלכות מילה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Creditor and Debtor": {
    "end": "27",
    "hebrewName": "משנה תורה, הלכות מלווה ולווה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Daily Offerings and Additional Offerings": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות תמידים ומוספין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Damages to Property": {
    "end": "14",
    "hebrewName": "משנה תורה, הלכות נזקי ממון",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Defilement by Leprosy": {
    "end": "16",
    "hebrewName": "משנה תורה, הלכות טומאת צרעת",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Defilement by a Corpse": {
    "end": "25",
    "hebrewName": "משנה תורה, הלכות טומאת מת",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Defilement of Foods": {
    "end": "16",
    "hebrewName": "משנה תורה, הלכות טומאת אוכלים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Diverse Species": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות כלאים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Divorce": {
    "end": "13",
    "hebrewName": "משנה תורה, הלכות גירושין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Eruvin": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות עירובין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Fasts": {
    "end": "5",
    "hebrewName": "משנה תורה, הלכות תעניות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Festival Offering": {
    "end": "3",
    "hebrewName": "משנה תורה, הלכות חגיגה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, First Fruits and other Gifts to Priests Outside the Sanctuary": {
    "end": "12",
    "hebrewName": "משנה תורה, הלכות ביכורים ושאר מתנות כהונה שבגבולין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Firstlings": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות בכורות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Forbidden Foods": {
    "end": "17",
    "hebrewName": "משנה תורה, הלכות מאכלות אסורות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Forbidden Intercourse": {
    "end": "22",
    "hebrewName": "משנה תורה, הלכות איסורי ביאה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Foreign Worship and Customs of the Nations": {
    "end": "12",
    "hebrewName": "משנה תורה, הלכות עבודה זרה וחוקות הגויים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Foundations of the Torah": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות יסודי התורה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Fringes": {
    "end": "3",
    "hebrewName": "משנה תורה, הלכות ציצית",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Gifts to the Poor": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות מתנות עניים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Heave Offerings": {
    "end": "15",
    "hebrewName": "משנה תורה, הלכות תרומות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Hiring": {
    "end": "13",
    "hebrewName": "משנה תורה, הלכות שכירות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Human Dispositions": {
    "end": "7",
    "hebrewName": "משנה תורה, הלכות דעות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Immersion Pools": {
    "end": "11",
    "hebrewName": "משנה תורה, הלכות מקואות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Inheritances": {
    "end": "11",
    "hebrewName": "משנה תורה, הלכות נחלות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Kings and Wars": {
    "end": "12",
    "hebrewName": "משנה תורה, הלכות מלכים ומלחמות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Leavened and Unleavened Bread": {
    "end": "9",
    "hebrewName": "משנה תורה, הלכות חמץ ומצה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Levirate Marriage and Release": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות יבום וחליצה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Marriage": {
    "end": "25",
    "hebrewName": "משנה תורה, הלכות אישות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Mourning": {
    "end": "14",
    "hebrewName": "משנה תורה, הלכות אבל",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Murderer and the Preservation of Life": {
    "end": "13",
    "hebrewName": "משנה תורה, הלכות רוצח ושמירת נפש",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Nazariteship": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות נזירות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Negative Mitzvot": {
    "end": "370",
    "hebrewName": "משנה תורה, מצוות לא תעשה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Neighbors": {
    "end": "14",
    "hebrewName": "משנה תורה, הלכות שכנים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Oaths": {
    "end": "12",
    "hebrewName": "משנה תורה, הלכות שבועות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Offerings for Those with Incomplete Atonement": {
    "end": "5",
    "hebrewName": "משנה תורה, הלכות מחוסרי כפרה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Offerings for Unintentional Transgressions": {
    "end": "15",
    "hebrewName": "משנה תורה, הלכות שגגות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, One Who Injures a Person or Property": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות חובל ומזיק",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Other Sources of Defilement": {
    "end": "20",
    "hebrewName": "משנה תורה, הלכות שאר אבות הטומאות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Overview of Mishneh Torah Contents": {
    "end": "14",
    "hebrewName": "משנה תורה, תוכן החיבור",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Ownerless Property and Gifts": {
    "end": "12",
    "hebrewName": "משנה תורה, הלכות זכייה ומתנה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Paschal Offering": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות קרבן פסח",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Plaintiff and Defendant": {
    "end": "16",
    "hebrewName": "משנה תורה, הלכות טוען ונטען",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Positive Mitzvot": {
    "end": "248",
    "hebrewName": "משנה תורה, מצוות עשה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Prayer and the Priestly Blessing": {
    "end": "15",
    "hebrewName": "משנה תורה, הלכות תפילה וברכת כהנים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Reading the Shema": {
    "end": "4",
    "hebrewName": "משנה תורה, הלכות קריאת שמע",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Rebels": {
    "end": "7",
    "hebrewName": "משנה תורה, הלכות ממרים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Red Heifer": {
    "end": "15",
    "hebrewName": "משנה תורה, הלכות פרה אדומה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Repentance": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות תשובה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Rest on a Holiday": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות שביתת יום טוב",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Rest on the Tenth of Tishrei": {
    "end": "3",
    "hebrewName": "משנה תורה, הלכות שביתת עשור",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Ritual Slaughter": {
    "end": "14",
    "hebrewName": "משנה תורה, הלכות שחיטה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Robbery and Lost Property": {
    "end": "18",
    "hebrewName": "משנה תורה, הלכות גזילה ואבידה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Sabbath": {
    "end": "30",
    "hebrewName": "משנה תורה, הלכות שבת",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Sabbatical Year and the Jubilee": {
    "end": "13",
    "hebrewName": "משנה תורה, הלכות שמיטה ויובל",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Sacrifices Rendered Unfit": {
    "end": "19",
    "hebrewName": "משנה תורה, הלכות פסולי המוקדשין",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Sacrificial Procedure": {
    "end": "19",
    "hebrewName": "משנה תורה, הלכות מעשה הקרבנות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Sales": {
    "end": "30",
    "hebrewName": "משנה תורה, הלכות מכירה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Sanctification of the New Month": {
    "end": "19",
    "hebrewName": "משנה תורה, הלכות קידוש החודש",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Scroll of Esther and Hanukkah": {
    "end": "4",
    "hebrewName": "משנה תורה, הלכות מגילה וחנוכה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Second Tithes and Fourth Year's Fruit": {
    "end": "11",
    "hebrewName": "משנה תורה, הלכות מעשר שני ונטע רבעי",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Service on the Day of Atonement": {
    "end": "5",
    "hebrewName": "משנה תורה, הלכות עבודת יום הכפורים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Sheqel Dues": {
    "end": "4",
    "hebrewName": "משנה תורה, הלכות שקלים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Shofar, Sukkah and Lulav": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות שופר וסוכה ולולב",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Slaves": {
    "end": "9",
    "hebrewName": "משנה תורה, הלכות עבדים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Substitution": {
    "end": "4",
    "hebrewName": "משנה תורה, הלכות תמורה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Tefillin, Mezuzah and the Torah Scroll": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות תפילין ומזוזה וספר תורה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Testimony": {
    "end": "22",
    "hebrewName": "משנה תורה, הלכות עדות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, The Chosen Temple": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות בית הבחירה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, The Order of Prayer": {
    "end": "5",
    "hebrewName": "משנה תורה, סדר התפילה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, The Sanhedrin and the Penalties within Their Jurisdiction": {
    "end": "26",
    "hebrewName": "משנה תורה, הלכות סנהדרין והעונשין המסורין להם",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Theft": {
    "end": "9",
    "hebrewName": "משנה תורה, הלכות גניבה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Things Forbidden on the Altar": {
    "end": "7",
    "hebrewName": "משנה תורה, הלכות איסורי המזבח",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Those Who Defile Bed or Seat": {
    "end": "13",
    "hebrewName": "משנה תורה, הלכות מטמאי משכב ומושב",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Tithes": {
    "end": "14",
    "hebrewName": "משנה תורה, הלכות מעשרות",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Torah Study": {
    "end": "7",
    "hebrewName": "משנה תורה, הלכות תלמוד תורה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Transmission of the Oral Law": {
    "end": "45",
    "hebrewName": "משנה תורה, מסירת תורה שבעל פה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Trespass": {
    "end": "8",
    "hebrewName": "משנה תורה, הלכות מעילה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Vessels": {
    "end": "28",
    "hebrewName": "משנה תורה, הלכות כלים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Vessels of the Sanctuary and Those Who Serve Therein": {
    "end": "10",
    "hebrewName": "משנה תורה, הלכות כלי המקדש והעובדין בו",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Virgin Maiden": {
    "end": "3",
    "hebrewName": "משנה תורה, הלכות נערה בתולה",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Vows": {
    "end": "13",
    "hebrewName": "משנה תורה, הלכות נדרים",
    "isMasechet": false,
    "start": "1"
  },
  "Mishneh Torah, Woman Suspected of Infidelity": {
    "end": "4",
    "hebrewName": "משנה תורה, הלכות סוטה",
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
  "Pirkei Avot": {
    "end": "6",
    "hebrewName": "משנה אבות",
    "isMasechet": false,
    "start": "1"
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
    "end": "Aleinu",
    "hebrewName": "סידור אשכנז",
    "isMasechet": false,
    "start": "Morning Blessings"
  },
  "SiddurSefard": {
    "end": "Conclusion",
    "hebrewName": "סידור ספרד",
    "isMasechet": false,
    "start": "Morning Blessings"
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
  "WeekdayTorah": {
    "end": "n/a",
    "hebrewName": "WeekdayTorah",
    "isMasechet": false,
    "start": "n/a"
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
};
