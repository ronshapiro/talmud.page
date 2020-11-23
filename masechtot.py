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

class Masechet(object):
    def __init__(self, canonical_name, aliases = (), start = "2a", end = None):
        self.canonical_name = canonical_name
        if type(aliases) is str:
            aliases = tuple([aliases])
        self.aliases = aliases
        self.start = start
        self.end = end
        amud = start
        self._amudim = []
        while amud != end:
            self._amudim.append(amud)
            amud = next_amud(amud)
        self._amudim.append(end)

    def does_amud_exist(self, amud):
        return amud in self._amudim

MASECHTOT = [
    Masechet(
        canonical_name = "Arakhin",
        aliases = ("Arachin", "ערכין"),
        end = "34a",
    ),
    Masechet(
        canonical_name = "Avodah Zarah",
        aliases = ("Avoda Zarah", "Avoda Zara", "Avodah Zara", "עבודה זרה"),
        end = "76b",
    ),
    Masechet(
        canonical_name = "Bava Batra",
        aliases = ("Bava Basra", "בבא בתרא"),
        end = "176b",
    ),
    Masechet(
        canonical_name = "Bava Kamma",
        aliases = ("Bava Kama", "בבא קמא"),
        end = "119b",
    ),
    Masechet(
        canonical_name = "Bava Metzia",
        aliases = ("Bava Metziah", "Bava Metsia", "Bava Metsiah",
                   "Bava Metsiah", "Bava Metsia", "Bava Metsiah",
                   "בבא מציעא"),
        end = "119a",
    ),
    Masechet(
        canonical_name = "Beitzah",
        aliases = ("Beitza", "Beitsah", "Beitsa", "ביצה"),
        end = "40b",
    ),
    Masechet(
        canonical_name = "Bekhorot",
        aliases = ("Bechorot", "Bechoros", "Bekhoros", "בכורות"),
        end = "61a",
    ),
    Masechet(
        canonical_name = "Berakhot",
        aliases = ("Berachot", "Brachot", "Brakhot",
                   "Berachos", "Brachos", "Brakhos", "Berakhos",
                   "ברכות"),
        end = "64a",
    ),
    Masechet(
        canonical_name = "Chagigah",
        aliases = ("Chagiga", "Khagigah", "Khagiga", "חגיגה"),
        end = "27a",
    ),
    Masechet(
        canonical_name = "Chullin",
        aliases = ("Chulin", "Hulin", "Hullin", "חולין"),
        end = "142a",
    ),
    Masechet(
        canonical_name = "Eruvin",
        aliases = ("Eiruvin", "עירובין"),
        end = "105a",
    ),
    Masechet(
        canonical_name = "Gittin",
        aliases = ("Gitin", "גיטין"),
        end = "90b",
    ),
    Masechet(
        canonical_name = "Horayot",
        aliases = ("Horayos", "הוריות"),
        end = "14a",
    ),
    Masechet(
        canonical_name = "Keritot",
        aliases = ("Ceritot", "Kritot", "Critot"
                   "Kerisos", "Cerisos", "Krisos", "Crisos",
                   "כריתות"),
        end = "28b",
    ),
    Masechet(
        canonical_name = "Ketubot",
        aliases = ("Ktubot",
                   "Kesubos", "Ksubos",
                   "כתובות"),
        end = "112b",
    ),
    Masechet(
        canonical_name = "Kiddushin",
        aliases = ("Kidushin", "קידושין"),
        end = "82b",
    ),
    Masechet(
        canonical_name = "Makkot",
        aliases = ("Makot", "Macot", "Maccot",
                   "Makos", "Macos", "Maccos", "Makkos",
                   "מכות"),
        end = "24b",
    ),
    Masechet(
        canonical_name = "Megillah",
        aliases = ("Megilla", "Megila", "Megilah", "מגילה"),
        end = "32a",
    ),
    Masechet(
        canonical_name = "Meilah",
        aliases = ("Meila", "מעילה"),
        end = "22a",
    ),
    Masechet(
        canonical_name = "Menachot",
        aliases = ("Menakhot", "Menachos", "Menakhos", "מנחות"),
        end = "110a",
    ),
    Masechet(
        canonical_name = "Moed Katan",
        aliases = ("Moed Catan", "מועד קטן"),
        end = "29a",
    ),
    Masechet(
        canonical_name = "Nazir",
        aliases = ("נזיר"),
        end = "66b",
    ),
    Masechet(
        canonical_name = "Nedarim",
        aliases = ("נדרים"),
        end = "91b",
    ),
    Masechet(
        canonical_name = "Niddah",
        aliases = ("Nidda", "Nidah", "Nida", "נדה"),
        end = "73a",
    ),
    Masechet(
        canonical_name = "Pesachim",
        aliases = ("Pesahim", "פסחים"),
        end = "121b",
    ),
    Masechet(
        canonical_name = "Rosh Hashanah",
        aliases = ("Rosh Hashana", "Rosh Hoshona", "Rosh Hoshonah",
                   "ראש השנה"),
        end = "35a",
    ),
    Masechet(
        canonical_name = "Sanhedrin",
        aliases = ("סנהדרין"),
        end = "113b",
    ),
    Masechet(
        canonical_name = "Shabbat",
        aliases = ("Shabat", "Chabbat", "Chabat",
                   "Shabos", "Chabbos", "Chabos",
                   "Shabbas", "Shabbos",
                   "שבת"),
        end = "157b",
    ),
    Masechet(
        canonical_name = "Shevuot",
        aliases = ("Shevuos", "שבועות"),
        end = "49b",
    ),
    Masechet(
        canonical_name = "Sotah",
        aliases = ("Sota", "Sottah", "Sotta", "סוטה"),
        end = "49b",
    ),
    Masechet(
        canonical_name = "Sukkah",
        aliases = ("Sukka", "Suka", "Succah", "Succa", "סוכה"),
        end = "56b",
    ),
    Masechet(
        canonical_name = "Taanit",
        aliases = ("Taanit", "Taanis", "Tanit", "Tanis", "תענית"),
        end = "31a",
    ),
    Masechet(
        canonical_name = "Tamid",
        aliases = ("Tammid", "תמיד"),
        start = "25b",
        end = "33b",
    ),
    Masechet(
        canonical_name = "Temurah",
        aliases = ("Temura", "תמורה"),
        end = "34a",
    ),
    Masechet(
        canonical_name = "Yevamot",
        aliases = ("Yevamos", "יבמות"),
        end = "122b",
    ),
    Masechet(
        canonical_name = "Yoma",
        aliases = ("Yuma", "Yomah", "Yumah", "יומא"),
        end = "88a",
    ),
    Masechet(
        canonical_name = "Zevachim",
        aliases = ("Zvachim", "Zevakhim", "זבחים"),
        end = "120b"),
]

MASECHTOT_BY_CANONICAL_NAME = {m.canonical_name: m for m in MASECHTOT}

class Masechtot(object):
    def __init__(self):
        self._masechet_name_index = {}
        for masechet in MASECHTOT:
            self._add_index_value(masechet.canonical_name.lower(), masechet.canonical_name)
            for alias in masechet.aliases:
                self._add_index_value(alias.lower(), masechet.canonical_name)

    def _add_index_value(self, index, value):
        self._masechet_name_index[index] = value
        self._masechet_name_index[index.replace(" ", "_")] = value

    def _canonical_masechet_name_or_none(self, name):
        name = name.lower().replace("'", "").replace("-", "")
        if name in self._masechet_name_index:
            return self._masechet_name_index[name]

    def canonical_masechet_name(self, name):
        result = self._canonical_masechet_name_or_none(name)
        if result:
            return result
        raise UnknownMasechetNameException(name)

    def canonical_url_masechet_name(self, name):
        """
        Returns the `canonical_masechet_name`, normalized for use in URLs.
        """
        return self.canonical_masechet_name(name).replace(" ", "_")

    def does_amud_exist(self, masechet_name, amud):
        canonical_masechet = self._canonical_masechet_name_or_none(masechet_name)
        if not canonical_masechet:
            return False
        masechet = MASECHTOT_BY_CANONICAL_NAME[canonical_masechet]
        return masechet.does_amud_exist(amud)

    def parse(self, query):
        query = query.strip()
        query = _MULTIPLE_SPACES.sub(" ", query)

        words = query.split(" ")
        masechet = self._canonical_masechet_name_or_none(words[0])
        if masechet:
            words = words[1:]
        elif len(words) > 1:
            masechet = self._canonical_masechet_name_or_none(f"{words[0]} {words[1]}")
            if not masechet:
                raise InvalidQueryException(f"Could not find Masechet: {query}")
            words = words[2:]
        else:
            raise InvalidQueryException(f"Could not find Masechet: {query}")

        if not len(words):
            raise InvalidQueryException(f'No amud specified in query: "{query}"')

        if len(words) == 1 and "-" in words[0]:
            amudim = words[0].split("-")
            if len(amudim) != 2:
                raise InvalidQueryException(f"Could not understand: {query}")
            words = [amudim[0], "-", amudim[1]]

        start = CanonicalizedAmud.create(words[0])
        if not start:
            raise InvalidQueryException(f"{words[0]} is not a valid amud")
        if len(words) == 1:
            if start.full_daf:
                return QueryResult.full_daf(masechet, start.full_daf)
            else:
                return QueryResult(masechet, start.single_amud)

        if len(words) == 3 and words[1] in _AMUD_RANGE_SEPARATORS:
            if start.full_daf:
                start_amud = "%sa" % start.full_daf
            else:
                start_amud = start.single_amud

            end = CanonicalizedAmud.create(words[2])

            if end.full_daf:
                end_amud = "%sb" % end.full_daf
            elif end.single_amud:
                end_amud = end.single_amud
            else:
                raise InvalidQueryException(f"Could not understand: {query}")

            return QueryResult(masechet, start_amud, end_amud)

        raise InvalidQueryException(f"Could not understand: {query}")


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


class QueryResult(object):
    def __init__(self, masechet, start, end=None):
        self.masechet = masechet
        self.start = start
        self.end = end

    @staticmethod
    def full_daf(masechet, page_number):
        return QueryResult(masechet, "%sa" % page_number, "%sb" % page_number)

    def __str__(self):
        return "{masechet: %s, start: %s, end: %s}" % (self.masechet, self.start, self.end)


class InvalidQueryException(Exception):
    def __init__(self, message):
        self.message = message


class UnknownMasechetNameException(Exception):
    def __init__(self, name):
        self.name = name
