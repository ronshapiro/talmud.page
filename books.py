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
