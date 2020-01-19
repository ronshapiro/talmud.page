#!/usr/bin/python
# -*- coding: utf-8 -*-

"""
Missing Rashis:
- Avodah Zarah
- Chullin
- Meilah
- Menachot
- Rosh Hashanah
- Sanhedrin
- Tamid
- Temurah
"""

# -os
# Remove apostrophes
MASECHTOT = {
    "Arakhin": ("Arachin"),
    "Bava Kamma": ("Bava Kama"),
    "Bekhorot": ("Bechorot"),
    "Chullin": ("Chulin"),
    "Gittin": ("Gitin"),
    "Keritot": ("Ceritot"),
    "Makkot": ("Makot", "Macot", "Maccot"),
    "Menachot": ("Menakhot"),
    "Nedarim": (),
    "Rosh Hashanah": ("Rosh Hashana"),
    "Shevuot": (),
    "Taanit": ("Taanit"),
    "Yevamot": (),
    "Avodah Zarah": ("Avoda Zarah", "Avoda Zara", "Avodah Zara"),
    "Bava Metzia": ("Bava Metziah", "Bava Metsia", "Bava Metsiah"),
    "Berakhot": ("Berachot", "Brachot", "Brakhot"),
    "Ketubot": (),
    "Megillah": ("Megilla", "Megila", "Megilah"),
    "Moed Katan": ("Moed Catan"),
    "Niddah": ("Nidda", "Nidah", "Nida"),
    "Sanhedrin": (),
    "Sotah": ("Sota"),
    "Tamid": (),
    "Yoma": ("Yuma", "Yomah", "Yumah"),
    "Bava Batra": (),
    "Beitzah": ("Beitza", "Beitsah"),
    "Chagigah": ("Chagiga", "Khagigah", "Khagiga"),
    "Eruvin": (),
    "Horayot": (),
    "Kiddushin": ("Kidushin"),
    "Meilah": ("Meila"),
    "Nazir": (),
    "Pesachim": (),
    "Shabbat": ("Shabat", "Chabbat", "Chabat"),
    "Sukkah": ("Sukka", "Suka", "Succah", "Succa"),
    "Temurah": ("Temura"),
    "Zevachim": (),
}

import json

def _index_sefaria_labels(text):
    index = {}
    for amud_number in range(2, len(text)):
        daf_number = int(amud_number / 2) + 1
        daf_letter = ("a", "b")[amud_number % 2]
        index["%s%s" %(daf_number, daf_letter)] = text[amud_number]
    return index

class Books(object):
    def __init__(self):
        self._define_text("gemara", "{masechet}/Hebrew/William Davidson Edition - Aramaic.json")
        self._define_text("gemara_english", "{masechet}/English/William Davidson Edition - English.json")
        self._define_text("rashi", "{masechet}/Rashi/Hebrew/Vilna Edition.json")
        self._define_text("tosafot", "{masechet}/Tosafot/Hebrew/Vilna Edition.json")

        self._masechet_name_index = {}
        for canonical_name, aliases in MASECHTOT.items():
            self._masechet_name_index[canonical_name] = canonical_name
            for alias in aliases:
                self._masechet_name_index[alias] = canonical_name
        self._has_loaded_hebrew_masechet_names = False

    def _define_text(self, name, path):
        cache_name = "%s_cache" % name
        setattr(self, cache_name, {})
        setattr(self, name, \
                lambda masechet: self._load_if_necessary(getattr(self, cache_name), masechet, path))

    def _load_if_necessary(self, cache, masechet, path):
        if masechet not in cache:
            file_name = "sefaria-data/Talmud/Bavli/%s" % path.format(masechet=masechet)
            cache[masechet] = _index_sefaria_labels(json.load(open(file_name))["text"])
        return cache[masechet]

    def canonical_masechet_name(self, name):
        if name in self._masechet_name_index:
            return self._masechet_name_index[name]
        if not self._has_loaded_hebrew_masechet_names:
            for hebrew, canonical in self._load_hebrew_masechet_names().items():
                self._masechet_name_index[hebrew] = canonical
            self._has_loaded_hebrew_masechet_names = True
            if name in self._masechet_name_index:
                return self._masechet_name_index[name]

        return None

    def _load_hebrew_masechet_names(self):
        hebrew_names = {}
        for masechet in MASECHTOT.keys():
            file_name = "sefaria-data/Talmud/Bavli/%s/Hebrew/William Davidson Edition - Aramaic.json" % masechet
            hebrew_names[json.load(open(file_name))["heTitle"]] = masechet
        return hebrew_names

