#!/usr/bin/python
# -*- coding: utf-8 -*-

from masechtot import MASECHTOT

class Books(object):
    def __init__(self):
        self._masechet_name_index = {}
        for canonical_name, aliases in MASECHTOT.items():
            self._masechet_name_index[canonical_name.lower()] = canonical_name
            for alias in aliases:
                self._masechet_name_index[alias.lower()] = canonical_name

    def canonical_masechet_name(self, name):
        original_name = name
        name = name.lower().replace("'", "").replace("-", "")
        if name in self._masechet_name_index:
            return self._masechet_name_index[name]

        raise KeyError(original_name)
