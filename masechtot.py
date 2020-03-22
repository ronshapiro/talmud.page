import hebrew
import re

MASECHTOT = {
    "Arakhin": ("Arachin", "ערכין",),
    "Avodah Zarah": ("Avoda Zarah", "Avoda Zara", "Avodah Zara", "עבודה זרה",),
    "Bava Batra": ("Bava Basra", "בבא בתרא",),
    "Bava Kamma": ("Bava Kama", "בבא קמא",),
    "Bava Metzia": ("Bava Metziah", "Bava Metsia", "Bava Metsiah",
                    "Bava Metsiah", "Bava Metsia", "Bava Metsiah",
                    "בבא מציעא",),
    "Beitzah": ("Beitza", "Beitsah", "Beitsa", "ביצה",),
    "Bekhorot": ("Bechorot", "Bechoros", "Bekhoros", "בכורות",),
    "Berakhot": ("Berachot", "Brachot", "Brakhot",
                 "Berachos", "Brachos", "Brakhos", "Berakhos",
                 "ברכות",),
    "Chagigah": ("Chagiga", "Khagigah", "Khagiga", "חגיגה",),
    "Chullin": ("Chulin", "Hulin", "Hullin", "חולין",),
    "Eruvin": ("עירובין",),
    "Gittin": ("Gitin", "גיטין",),
    "Horayot": ("Horayos", "הוריות",),
    "Keritot": ("Ceritot", "Kritot", "Critot"
                "Kerisos", "Cerisos", "Krisos", "Crisos",
                "כריתות",),
    "Ketubot": ("Ktubot",
                "Kesubos", "Ksubos", "כתובות",),
    "Kiddushin": ("Kidushin", "קידושין",),
    "Makkot": ("Makot", "Macot", "Maccot",
               "Makos", "Macos", "Maccos", "Makkos",
               "מכות",),
    "Megillah": ("Megilla", "Megila", "Megilah", "מגילה",),
    "Meilah": ("Meila", "מעילה",),
    "Menachot": ("Menakhot", "Menachos", "Menakhos", "מנחות",),
    "Moed Katan": ("Moed Catan", "מועד קטן",),
    "Nazir": ("נזיר",),
    "Nedarim": ("נדרים",),
    "Niddah": ("Nidda", "Nidah", "Nida", "נדה",),
    "Pesachim": ("פסחים",),
    "Rosh Hashanah": ("Rosh Hashana", "Rosh Hoshona", "Rosh Hoshonah",
                      "ראש השנה",),
    "Sanhedrin": ("סנהדרין",),
    "Shabbat": ("Shabat", "Chabbat", "Chabat",
                "Shabos", "Chabbos", "Chabos",
                "Shabbas", "Shabbos",
                "שבת",),
    "Shevuot": ("Shevuos", "שבועות",),
    "Sotah": ("Sota", "Sottah", "Sotta", "סוטה",),
    "Sukkah": ("Sukka", "Suka", "Succah", "Succa", "סוכה",),
    "Taanit": ("Taanit", "Taanis", "Tanit", "Tanis", "תענית",),
    "Tamid": ("תמיד",),
    "Temurah": ("Temura", "תמורה",),
    "Yevamot": ("Yevamos", "יבמות",),
    "Yoma": ("Yuma", "Yomah", "Yumah", "יומא",),
    "Zevachim": ("Zvachim", "Zevakhim", "זבחים",),
}

_MULTIPLE_SPACES = re.compile("  +")

_AMUD_ALEPH_OPTIONS = ("a", ".")
_AMUD_BET_OPTIONS = ("b", ":")

_AMUD_RANGE_SEPARATORS = ("to", "-")

_ALL_NUMBERS = re.compile("^\d+$")
_ALL_HEBREW_LETTERS = re.compile("^(?=.+)%s?%s?%s?$" % (
    "ק", # there are no masechtot with more than 200 dapim
    "[יכלמנסעפצ]",
    "[א-ט]",
))

_AB_PATTERN = re.compile("^(\d{1,3})ab$")

def _daf_without_aleph_or_bet(amud):
    if _ALL_NUMBERS.match(amud):
        return amud
    elif _ALL_HEBREW_LETTERS.match(amud):
        return hebrew.numeric_literal_as_int(amud)

class Masechtot(object):
    def __init__(self):
        self._masechet_name_index = {}
        for canonical_name, aliases in MASECHTOT.items():
            self._masechet_name_index[canonical_name.lower()] = canonical_name
            for alias in aliases:
                self._masechet_name_index[alias.lower()] = canonical_name

    def _canonical_masechet_name_or_none(self, name):
        name = name.lower().replace("'", "").replace("-", "")
        if name in self._masechet_name_index:
            return self._masechet_name_index[name]

    def canonical_masechet_name(self, name):
        result = self._canonical_masechet_name_or_none(name)
        if result:
            return result
        raise KeyError(original_name)

    def parse(self, query):
        query = query.strip()
        query = _MULTIPLE_SPACES.sub(" ", query)

        words = query.split(" ")
        masechet = self._canonical_masechet_name_or_none(words[0])
        if masechet:
            words = words[1:]
        elif len(words) > 1:
            masechet = self.canonical_masechet_name("%s %s" %(words[0], words[1]))
            words = words[2:]
        else:
            raise ValueError(query)

        if len(words) is 1 and "-" in words[0]:
            amudim = words[0].split("-")
            if len(amudim) is not 2:
                raise ValueError(query)
            words = [amudim[0], "-", amudim[1]]

        start = CanonicalizedAmud.create(words[0])
        if not start:
            raise ValueError(query)
        if len(words) is 1:
            if start.full_daf:
                return QueryResult.full_daf(masechet, start.full_daf)
            else:
                return QueryResult(masechet, start.single_amud)

        if len(words) is 3 and words[1] in _AMUD_RANGE_SEPARATORS:
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
                raise ValueError(query)

            return QueryResult(masechet, start_amud, end_amud)

        raise ValueError(query)


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
