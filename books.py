import hebrew
import re

_MULTIPLE_SPACES = re.compile(r"  +")

_AMUD_ALEPH_OPTIONS = ("a", ".")
_AMUD_BET_OPTIONS = ("b", ":")

_AMUD_RANGE_SEPARATORS = ("to", "-")

_ALL_NUMBERS = re.compile(r"^\d+$")
_ALL_HEBREW_LETTERS = re.compile(r"^(?=.+)%s?%s?%s?$" % (
    "ק", # there are no masechtot with more than 200 dapim
    "[יכלמנסעפצ]",
    "[א-ט]",
))

_AB_PATTERN = re.compile(r"^(\d{1,3})ab$")

def _daf_without_aleph_or_bet(amud):
    if _ALL_NUMBERS.match(amud):
        return amud
    elif _ALL_HEBREW_LETTERS.match(amud):
        return hebrew.numeric_literal_as_int(amud)

def next_amud(amud):
    if amud[-1:] == "a":
        return "%sb" % amud[:-1]
    return "%sa" % (int(amud[:-1]) + 1)

def previous_amud(amud):
    if amud[-1:] == "b":
        return "%sa" % amud[:-1]
    return "%sb" % (int(amud[:-1]) - 1)

class Book(object):
    def __init__(
            self,
            canonical_name,
            hebrew_name,
            aliases,
            start,
            end,
            sections):
        self.canonical_name = canonical_name
        self.hebrew_name = hebrew_name
        if type(aliases) is str:
            aliases = tuple([aliases])
        aliases = tuple([hebrew_name] + list(aliases))
        self.aliases = aliases
        self.start = start
        self.end = end
        self.sections = sections

    def does_section_exist(self, section):
        return section in self.sections

    def is_masechet(self):
        return False

    def __str__(self):
        return f"{self.book_type}[{self.canonical_name}]"

def amudim(start, end):
    _amudim = []
    amud = start
    while amud != end:
        _amudim.append(amud)
        amud = next_amud(amud)
    _amudim.append(end)
    return _amudim

class Masechet(Book):
    book_type = "Masechet"

    def __init__(
            self,
            canonical_name,
            hebrew_name,
            # https://bit.ly/vocalized-masechet-names
            vocalized_hebrew_name,
            aliases,
            start = "2a",
            end = None):
        super().__init__(canonical_name, hebrew_name, aliases, start, end, amudim(start, end))
        self.vocalized_hebrew_name = vocalized_hebrew_name

    def is_masechet(self):
        return True


class BibleBook(Book):
    book_type = "Book"

    def __init__(
            self,
            canonical_name,
            hebrew_name,
            aliases,
            end):
        super().__init__(
            canonical_name, hebrew_name, aliases, "1", end,
            tuple(map(str, range(1, int(end) + 1))))

def format_list_english(items):
    not_last = ", ".join(items[:-1])
    return f"{not_last} and {items[-1]}"


class CanonicalizedAmud(object):
    def __init__(self, single_amud, full_daf):
        self.single_amud = single_amud
        self.full_daf = full_daf

    @staticmethod
    def create(string):
        number_with_ab = _AB_PATTERN.match(string)
        if number_with_ab:
            return CanonicalizedAmud(None, number_with_ab.group(1))

        daf_without_aleph_or_bet = _daf_without_aleph_or_bet(string)
        if daf_without_aleph_or_bet:
            return CanonicalizedAmud(None, daf_without_aleph_or_bet)

        number = _daf_without_aleph_or_bet(string[:-1])
        if not number:
            return None

        if string[-1] in _AMUD_ALEPH_OPTIONS:
            return CanonicalizedAmud("%sa" % number, None)
        elif string[-1] in _AMUD_BET_OPTIONS:
            return CanonicalizedAmud("%sb" % number, None)

    def __str__(self):
        return str({"single_amud": self.single_amud,
                    "full_daf": self.full_daf})


class AmudRangeParser(object):
    def validate(self, pages):
        invalid = []
        for page in pages:
            if not CanonicalizedAmud.create(page):
                invalid.append(page)

        if len(invalid) == 0:
            return
        if len(invalid) == 1:
            raise InvalidQueryException(f"{invalid[0]} is not a valid amud")
        raise InvalidQueryException(f"{format_list_english(invalid)} are not valid amudim")

    def create_single(self, title, page):
        start = CanonicalizedAmud.create(page)
        if start.full_daf:
            return QueryResult.full_daf(title, start.full_daf)
        else:
            return QueryResult(title, start.single_amud)

    def create_range(self, title, start, end):
        start = CanonicalizedAmud.create(start)
        end = CanonicalizedAmud.create(end)

        if start.full_daf:
            start_amud = "%sa" % start.full_daf
        else:
            start_amud = start.single_amud

        if end.full_daf:
            end_amud = "%sb" % end.full_daf
        else:
            end_amud = end.single_amud

        return QueryResult(title, start_amud, end_amud)


class ChapterRangeParser(object):
    def validate(self, pages):
        invalid = []
        for page in pages:
            try:
                int(page)
            except ValueError:
                invalid.append(page)

        if len(invalid) == 0:
            return
        if len(invalid) == 1:
            raise InvalidQueryException(f"{invalid[0]} is not a number")
        raise InvalidQueryException(f"{format_list_english(invalid)} are not numbers")

    def create_single(self, title, page):
        return QueryResult(title, page)

    def create_range(self, title, start, end):
        return QueryResult(title, start, end)


class BookIndex(object):
    def __init__(self, all_books):
        self.all_books = all_books
        self.by_canonical_name = {b.canonical_name: b for b in all_books}
        self.by_canonical_name.update({b.canonical_name.replace(" ", "_"): b for b in all_books})
        self._name_index = {}
        for book in all_books:
            self._add_index_value(book.canonical_name.lower(), book.canonical_name)
            for alias in book.aliases:
                self._add_index_value(alias.lower(), book.canonical_name)

    def _add_index_value(self, index, value):
        self._name_index[index] = value
        self._name_index[index.replace(" ", "_")] = value

    def _canonical_name_or_none(self, name):
        name = name.lower().replace("'", "").replace("-", "")
        if name in self._name_index:
            return self._name_index[name]

    def canonical_name(self, name):
        result = self._canonical_name_or_none(name)
        if result:
            return result
        raise UnknownBookNameException(name)

    def canonical_url_name(self, name):
        """
        Returns the `canonical_name`, normalized for use in URLs.
        """
        return self.canonical_name(name).replace(" ", "_")

    def does_section_exist(self, name, section):
        canonical_name = self._canonical_name_or_none(name)
        if not canonical_name:
            return False
        return self.by_canonical_name[canonical_name].does_section_exist(section)

    def parse(self, query):
        query = query.strip()
        query = _MULTIPLE_SPACES.sub(" ", query)

        words = query.split(" ")
        for i in range(1, len(words) + 1):
            title = self._canonical_name_or_none(" ".join(words[:i]))
            if title:
                words = words[i:]
                break
        if not title:
            raise InvalidQueryException(f"Could not find title: {query}")

        book = self.by_canonical_name[title]

        if not len(words):
            section_word = "amud" if book.is_masechet() else "section"
            raise InvalidQueryException(f'No {section_word} specified in query: "{query}"')

        if len(words) == 1 and "-" in words[0]:
            sections = words[0].split("-")
            if len(sections) != 2:
                raise InvalidQueryException(f"Could not understand: {query}")
            words = [sections[0], "-", sections[1]]

        pages_parser = AmudRangeParser() if book.is_masechet() else ChapterRangeParser()

        if len(words) == 1:
            pages_parser.validate(words)
            return pages_parser.create_single(title, words[0])

        if len(words) == 3 and words[1] in _AMUD_RANGE_SEPARATORS:
            return pages_parser.create_range(title, words[0], words[2])

        raise InvalidQueryException(f"Could not understand: {query}")


class QueryResult(object):
    def __init__(self, book_name, start, end=None):
        self.book_name = book_name
        self.start = start
        self.end = end

    @staticmethod
    def full_daf(book_name, page_number):
        return QueryResult(book_name, "%sa" % page_number, "%sb" % page_number)

    def __str__(self):
        return "{book_name: %s, start: %s, end: %s}" % (self.book_name, self.start, self.end)

    def to_url_pathname(self):
        pathname = f"/{self.book_name}/{self.start}"
        if self.end:
            pathname += f"/to/{self.end}"
        return pathname


class InvalidQueryException(Exception):
    def __init__(self, message):
        self.message = message


class UnknownBookNameException(Exception):
    def __init__(self, name):
        self.name = name


BOOKS = BookIndex([
    Masechet(
        canonical_name = "Arakhin",
        hebrew_name = "ערכין",
        vocalized_hebrew_name = "עֲרָכִין",
        aliases = ("Arachin"),
        end = "34a",
    ),
    Masechet(
        canonical_name = "Avodah Zarah",
        hebrew_name = "עבודה זרה",
        vocalized_hebrew_name = "עֲבוֹדָה זָרָה",
        aliases = ("Avoda Zarah", "Avoda Zara", "Avodah Zara"),
        end = "76b",
    ),
    Masechet(
        canonical_name = "Bava Batra",
        hebrew_name = "בבא בתרא",
        vocalized_hebrew_name = "בָּבָא בָּתְרָא",
        aliases = ("Bava Basra"),
        end = "176b",
    ),
    Masechet(
        canonical_name = "Bava Kamma",
        hebrew_name = "בבא קמא",
        vocalized_hebrew_name = "בָּבָא קַמָּא",
        aliases = ("Bava Kama"),
        end = "119b",
    ),
    Masechet(
        canonical_name = "Bava Metzia",
        hebrew_name = "בבא מציעא",
        vocalized_hebrew_name = "בָּבָא מְצִיעָא",
        aliases = ("Bava Metziah", "Bava Metsia", "Bava Metsiah",
                   "Bava Metsiah", "Bava Metsia", "Bava Metsiah"),
        end = "119a",
    ),
    Masechet(
        canonical_name = "Beitzah",
        hebrew_name = "ביצה",
        vocalized_hebrew_name = "בֵּיצָה",
        aliases = ("Beitza", "Beitsah", "Beitsa"),
        end = "40b",
    ),
    Masechet(
        canonical_name = "Bekhorot",
        hebrew_name = "בכורות",
        vocalized_hebrew_name = "בְּכוֹרוֹת",
        aliases = ("Bechorot", "Bechoros", "Bekhoros"),
        end = "61a",
    ),
    Masechet(
        canonical_name = "Berakhot",
        hebrew_name = "ברכות",
        vocalized_hebrew_name = "בְּרָכוֹת",
        aliases = ("Berachot", "Brachot", "Brakhot",
                   "Berachos", "Brachos", "Brakhos", "Berakhos"),
        end = "64a",
    ),
    Masechet(
        canonical_name = "Chagigah",
        hebrew_name = "חגיגה",
        vocalized_hebrew_name = "חֲגִיגָה",
        aliases = ("Chagiga", "Khagigah", "Khagiga"),
        end = "27a",
    ),
    Masechet(
        canonical_name = "Chullin",
        hebrew_name = "חולין",
        vocalized_hebrew_name = "חֻלִּין",
        aliases = ("Chulin", "Hulin", "Hullin"),
        end = "142a",
    ),
    Masechet(
        canonical_name = "Eruvin",
        hebrew_name = "עירובין",
        vocalized_hebrew_name = "עֵירוּבִין",
        aliases = ("Eiruvin"),
        end = "105a",
    ),
    Masechet(
        canonical_name = "Gittin",
        hebrew_name = "גיטין",
        vocalized_hebrew_name = "גִּיטִּין",
        aliases = ("Gitin"),
        end = "90b",
    ),
    Masechet(
        canonical_name = "Horayot",
        hebrew_name = "הוריות",
        vocalized_hebrew_name = "הוֹרָיוֹת",
        aliases = ("Horayos"),
        end = "14a",
    ),
    Masechet(
        canonical_name = "Keritot",
        hebrew_name = "כריתות",
        vocalized_hebrew_name = "כְּרִיתוֹת",
        aliases = ("Ceritot", "Kritot", "Critot"
                   "Kerisos", "Cerisos", "Krisos", "Crisos"),
        end = "28b",
    ),
    Masechet(
        canonical_name = "Ketubot",
        hebrew_name = "כתובות",
        vocalized_hebrew_name = "כְּתֻבּוֹת",
        aliases = ("Ktubot",
                   "Kesubos", "Ksubos"),
        end = "112b",
    ),
    Masechet(
        canonical_name = "Kiddushin",
        hebrew_name = "קידושין",
        vocalized_hebrew_name = "קִדּוּשִׁין",
        aliases = ("Kidushin"),
        end = "82b",
    ),
    Masechet(
        canonical_name = "Makkot",
        hebrew_name = "מכות",
        vocalized_hebrew_name = "מַכּוֹת",
        aliases = ("Makot", "Macot", "Maccot",
                   "Makos", "Macos", "Maccos", "Makkos"),
        end = "24b",
    ),
    Masechet(
        canonical_name = "Megillah",
        hebrew_name = "מגילה",
        vocalized_hebrew_name = "מְגִלָּה",
        aliases = ("Megilla", "Megila", "Megilah"),
        end = "32a",
    ),
    Masechet(
        canonical_name = "Meilah",
        vocalized_hebrew_name = "מְעִילָה",
        hebrew_name = "מעילה",
        aliases = ("Meila"),
        end = "22a",
    ),
    Masechet(
        canonical_name = "Menachot",
        hebrew_name = "מנחות",
        vocalized_hebrew_name = "מְנָחוֹת",
        aliases = ("Menakhot", "Menachos", "Menakhos"),
        end = "110a",
    ),
    Masechet(
        canonical_name = "Moed Katan",
        hebrew_name = "מועד קטן",
        vocalized_hebrew_name = "מוֹעֵד קָטָן",
        aliases = ("Moed Catan"),
        end = "29a",
    ),
    Masechet(
        canonical_name = "Nazir",
        hebrew_name = "נזיר",
        vocalized_hebrew_name = "נָזִיר",
        aliases = (),
        end = "66b",
    ),
    Masechet(
        canonical_name = "Nedarim",
        hebrew_name = "נדרים",
        vocalized_hebrew_name = "נְדָרִים",
        aliases = (),
        end = "91b",
    ),
    Masechet(
        canonical_name = "Niddah",
        hebrew_name = "נדה",
        vocalized_hebrew_name = "נִדָּה",
        aliases = ("Nidda", "Nidah", "Nida"),
        end = "73a",
    ),
    Masechet(
        canonical_name = "Pesachim",
        hebrew_name = "פסחים",
        vocalized_hebrew_name = "פְּסָחִים",
        aliases = ("Pesahim"),
        end = "121b",
    ),
    Masechet(
        canonical_name = "Rosh Hashanah",
        hebrew_name = "ראש השנה",
        vocalized_hebrew_name = "רֹאשׁ הַשָּׁנָה",
        aliases = ("Rosh Hashana", "Rosh Hoshona", "Rosh Hoshonah"),
        end = "35a",
    ),
    Masechet(
        canonical_name = "Sanhedrin",
        hebrew_name = "סנהדרין",
        vocalized_hebrew_name = "סַנהֶדרִין",
        aliases = (),
        end = "113b",
    ),
    Masechet(
        canonical_name = "Shabbat",
        hebrew_name = "שבת",
        vocalized_hebrew_name = "שַׁבָּת",
        aliases = ("Shabat", "Chabbat", "Chabat",
                   "Shabos", "Chabbos", "Chabos",
                   "Shabbas", "Shabbos"),
        end = "157b",
    ),
    Masechet(
        canonical_name = "Shevuot",
        hebrew_name = "שבועות",
        vocalized_hebrew_name = "שְׁבוּעוֹת",
        aliases = ("Shevuos"),
        end = "49b",
    ),
    Masechet(
        canonical_name = "Sotah",
        hebrew_name = "סוטה",
        vocalized_hebrew_name = "סוֹטָה",
        aliases = ("Sota", "Sottah", "Sotta"),
        end = "49b",
    ),
    Masechet(
        canonical_name = "Sukkah",
        hebrew_name = "סוכה",
        vocalized_hebrew_name = "סֻכָּה",
        aliases = ("Sukka", "Suka", "Succah", "Succa"),
        end = "56b",
    ),
    Masechet(
        canonical_name = "Taanit",
        hebrew_name = "תענית",
        vocalized_hebrew_name = "תַּעֲנִית",
        aliases = ("Taanit", "Taanis", "Tanit", "Tanis"),
        end = "31a",
    ),
    Masechet(
        canonical_name = "Tamid",
        hebrew_name = "תמיד",
        vocalized_hebrew_name = "תָּמִיד",
        aliases = ("Tammid"),
        start = "25b",
        end = "33b",
    ),
    Masechet(
        canonical_name = "Temurah",
        hebrew_name = "תמורה",
        vocalized_hebrew_name = "תְּמוּרָה",
        aliases = ("Temura"),
        end = "34a",
    ),
    Masechet(
        canonical_name = "Yevamot",
        hebrew_name = "יבמות",
        vocalized_hebrew_name = "יְבָמוֹת",
        aliases = ("Yevamos"),
        end = "122b",
    ),
    Masechet(
        canonical_name = "Yoma",
        hebrew_name = "יומא",
        vocalized_hebrew_name = "יוֹמָא",
        aliases = ("Yuma", "Yomah", "Yumah"),
        end = "88a",
    ),
    Masechet(
        canonical_name = "Zevachim",
        hebrew_name = "זבחים",
        vocalized_hebrew_name = "זְבָחִים",
        aliases = ("Zvachim", "Zevakhim"),
        end = "120b"),
    BibleBook(
        canonical_name = "Genesis",
        hebrew_name = "בראשית",
        aliases = ("Bereshit", "Breishit", "Bereishit", "Beresheet", "Bereshith", "Bereishis"),
        end = "50"),
    BibleBook(
        canonical_name = "Exodus",
        hebrew_name = "שמות",
        aliases = ("Shmot", "Shemot", "Shemoth", "Shemos"),
        end = "40"),
    BibleBook(
        canonical_name = "Leviticus",
        hebrew_name = "ויקרא",
        aliases = ("Vayikra", "Vayikrah"),
        end = "27"),
    BibleBook(
        canonical_name = "Numbers",
        hebrew_name = "במדבר",
        aliases = ("Bamidbar", "Bemidbar", ),
        end = "36"),
    BibleBook(
        canonical_name = "Deuteronomy",
        hebrew_name = "דברים",
        aliases = ("Devarim", "Dvarim", "Devorim"),
        end = "34"),
    BibleBook(
        canonical_name = "Joshua",
        hebrew_name = "יהושע",
        aliases = ("Yehoshua",),
        end = "24"),
    BibleBook(
        canonical_name = "Judges",
        hebrew_name = "שופטים",
        aliases = ("Shoftim",),
        end = "21"),
    BibleBook(
        canonical_name = "I Samuel",
        hebrew_name = "שמואל א",
        aliases = (
            "First Samuel", "Shmuel Aleph", "Shmuel Alef", "I Shmuel", "Samuel I", "Shmuel I",
            "1 Samuel", "I Shemuel", "I. Samuel",),
        end = "31"),
    BibleBook(
        canonical_name = "II Samuel",
        hebrew_name = "שמואל ב",
        aliases = (
            "Second Samuel", "Shmuel Bet", "Shmuel II", "Samuel II", "II Shmuel", "2 Samuel",
            "II Shemuel", "II. Samuel",),
        end = "24"),
    BibleBook(
        canonical_name = "I Kings",
        hebrew_name = "מלכים א",
        aliases = (
            "I Melachim", "Melachim Aleph", "Melachim Alef", "Kings I", "Melachim I", "1 Kings",
            "First Kings", "I Melakhim", "I. Kings", "מל״א",
            'מל"א'),
        end = "22"),
    BibleBook(
        canonical_name = "II Kings",
        hebrew_name = "מלכים ב",
        aliases = (
            "Melachim Bet", "Melachim II", "Second Kings", "2 Kings", "II Melachim", "Kings II",
            "II Melakhim", "II. Kings", "מל״ב",
            'מל"ב'),
        end = "25"),
    BibleBook(
        canonical_name = "Isaiah",
        hebrew_name = "ישעיהו",
        aliases = ("Isaia", "Yishayahu", "Yeshayahu"),
        end = "66"),
    BibleBook(
        canonical_name = "Jeremiah",
        hebrew_name = "ירמיהו",
        aliases = ("Yirmiyahu", "Yirmiyohu", "Yermiyahu", "Yirmeyahu"),
        end = "52"),
    BibleBook(
        canonical_name = "Ezekiel",
        hebrew_name = "יחזקאל",
        aliases = ("Yehezkel", "Yechezkel", "Yechezkiel"),
        end = "48"),
    BibleBook(
        canonical_name = "Hosea",
        hebrew_name = "הושע",
        aliases = ("Hoshea"),
        end = "14"),
    BibleBook(
        canonical_name = "Joel",
        hebrew_name = "יואל",
        aliases = ("Yoel",),
        end = "4"),
    BibleBook(
        canonical_name = "Amos",
        hebrew_name = "עמוס",
        aliases = (),
        end = "9"),
    BibleBook(
        canonical_name = "Obadiah",
        hebrew_name = "עובדיה",
        aliases = ("Ovadiah", "Ovadyah", "Ovadia", "Ovadya"),
        end = "1"),
    BibleBook(
        canonical_name = "Jonah",
        hebrew_name = "יונה",
        aliases = ("Yonah",),
        end = "4"),
    BibleBook(
        canonical_name = "Micah",
        hebrew_name = "מיכה",
        aliases = ("Mikha", "Michah", "Micha"),
        end = "7"),
    BibleBook(
        canonical_name = "Nahum",
        hebrew_name = "נחום",
        aliases = ("Nachum",),
        end = "3"),
    BibleBook(
        canonical_name = "Habakkuk",
        hebrew_name = "חבקוק",
        aliases = ("Havakkuk", "Habakuk", "Habbakuk"),
        end = "3"),
    BibleBook(
        canonical_name = "Zephaniah",
        hebrew_name = "צפניה",
        aliases = ("Tzephaniah", "Zephania", "Tzephania"),
        end = "3"),
    BibleBook(
        canonical_name = "Haggai",
        hebrew_name = "חגי",
        aliases = ("Chaggai", "Hagai", "Chagai", "Chaggay", "Hagay", "Chagay"),
        end = "2"),
    BibleBook(
        canonical_name = "Zechariah",
        hebrew_name = "זכריה",
        aliases = ("Zachariah", "Zekharia", "Zekharya", "Zecharia", "Zecharyah"),
        end = "14"),
    BibleBook(
        canonical_name = "Malachi",
        hebrew_name = "מלאכי",
        aliases = ("Malakhi",),
        end = "3"),
    BibleBook(
        canonical_name = "Psalms",
        hebrew_name = "תהילים",
        aliases = ("Tehilim", "Psalm", "Tehillim"),
        end = "150"),
    BibleBook(
        canonical_name = "Proverbs",
        hebrew_name = "משלי",
        aliases = ("Mishlei", "Mishle"),
        end = "31"),
    BibleBook(
        canonical_name = "Job",
        hebrew_name = "איוב",
        aliases = ("Iyov", "Iyyov"),
        end = "42"),
    BibleBook(
        canonical_name = "Song of Songs",
        hebrew_name = "שיר השירים",
        aliases = (
            "Shir HaShirim", "Songs", "Shir haShirim", "Shir Hashirim", "שיה״ש",
            'שיה"ש',),
        end = "8"),
    BibleBook(
        canonical_name = "Ruth",
        hebrew_name = "רות",
        aliases = ("Rut"),
        end = "4"),
    BibleBook(
        canonical_name = "Lamentations",
        hebrew_name = "איכה",
        aliases = ("Eichah", "Eicha", "Eikhah"),
        end = "5"),
    BibleBook(
        canonical_name = "Ecclesiastes",
        hebrew_name = "קהלת",
        aliases = ("Kohelet", "Koheleth",),
        end = "12"),
    BibleBook(
        canonical_name = "Esther",
        hebrew_name = "אסתר",
        aliases = ("Ester", "מגילת אסתר"),
        end = "10"),
    BibleBook(
        canonical_name = "Daniel",
        hebrew_name = "דניאל",
        aliases = (),
        end = "12"),
    BibleBook(
        canonical_name = "Ezra",
        hebrew_name = "עזרא",
        aliases = (),
        end = "10"),
    BibleBook(
        canonical_name = "Nehemiah",
        hebrew_name = "נחמיה",
        aliases = ("Nehemia", "Nechemia", "Nechemiah", "Nehemya", "Nechemya", "Nechemyah",
                   "Nehemiya", "Nechemiya", "Nechemiyah"),
        end = "13"),
    BibleBook(
        canonical_name = "I Chronicles",
        hebrew_name = "דברי הימים א",
        aliases = (
            "1 Chronicles", "Chronicles I", "I Divrei HaYamim", "Divrei HaYamim I",
            "Divrei HaYamim Aleph", "Divrei HaYamim Alef", "First Chronicles", "I Divrei Ha-yamim",
            "I Divrei Ha-Yamim", "I Divrei Hayomim", "Divre HaYamim I", "Divrei Hayamim I",
            "דהי״א",
            'דהי"א',
        ),
        end = "29"),
    BibleBook(
        canonical_name = "II Chronicles",
        hebrew_name = "דברי הימים ב",
        aliases = (
            "2 Chronicles", "II Divrei HaYamim", "Second Chronicles", "Chronicles II",
            "Divrei HaYamim II", "Divrei HaYamim Bet", "II Divrei Ha-yamim", "II Divrei Ha-Yamim",
            "II Divrei Hayomim", "Divre HaYamim II", "Divrei Hayamim II",
            "דהי״ב",
            'דהי"ב',
        ),
        end = "36"),
])
