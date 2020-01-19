#!/usr/bin/python
# -*- coding: utf-8 -*-

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

class _EmptyMasechet(object):
    def __getitem__(self, x):
        return ()

class _Source(object):
    def __init__(self, json_file_paths, known_missing_masechtot = ()):
        self.json_file_paths = json_file_paths
        self.cache = {}
        for missing_masechet in known_missing_masechtot:
            self.cache[missing_masechet] = _EmptyMasechet()

    def __call__(self, masechet):
        if masechet not in self.cache:
            for file_path in self.json_file_paths:
                file_path.format(masechet=masechet)
                file_name = "sefaria-data/Talmud/Bavli/%s" % (file_path.format(masechet=masechet))
                try:
                    with open(file_name) as json_file:
                        self.cache[masechet] = _index_sefaria_labels(json.load(json_file)["text"])
                except FileNotFoundError:
                    continue
        
        return self.cache[masechet]

class Books(object):
    def __init__(self):
        self.gemara = _Source(["{masechet}/Hebrew/William Davidson Edition - Aramaic.json"])
        self.gemara_english = _Source(["{masechet}/English/William Davidson Edition - English.json"])
        self.rashi = _Source(("{masechet}/Rashi/Hebrew/Vilna Edition.json",
                              "{masechet}/Rashi/Hebrew/WikiSource Rashi.json",
                              "{masechet}/Rashi/Hebrew/Wikisource Rashi.json"),
                             known_missing_masechtot = ["Tamid"])
        self.tosafot = _Source(("{masechet}/Tosafot/Hebrew/Vilna Edition.json",
                                "{masechet}/Tosafot/Hebrew/Vilna edition.json",
                                "{masechet}/Rashi/Hebrew/WikiSource Tosafot.json",
                                "{masechet}/Rashi/Hebrew/Wikisource Tosafot.json"),
                               known_missing_masechtot = ["Tamid"])

        self._masechet_name_index = {}
        for canonical_name, aliases in MASECHTOT.items():
            self._masechet_name_index[canonical_name] = canonical_name
            for alias in aliases:
                self._masechet_name_index[alias] = canonical_name
        self._has_loaded_hebrew_masechet_names = False

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
