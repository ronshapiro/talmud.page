#!/usr/bin/python
# -*- coding: utf-8 -*-

import json

class Books(object):
    def __init__(self):
        self.vocalized_cache = {}
        self.english_cache = {}

        self.vocalized = lambda book: \
                         self._load_if_necessary(self.vocalized_cache, "vocalized", book)
        self.english = lambda book: \
                       self._load_if_necessary(self.english_cache, "english", book)

        self.vocalized_verse = lambda result: self._verse(self.vocalized, result)
        self.english_verse = lambda result: self._verse(self.english, result)

    def _load_text(self, folder, name):
        file_name = "sefaria-data/%s/%s.json" % (folder, name)
        return json.load(open(file_name))["text"]

    def _load_if_necessary(self, cache, folder, book):
        if book not in cache:
            cache[book] = self._load_text(folder, book)
        return cache[book]

    # type(result) == SearchResult
    def _verse(self, _get_book, result):
        return _get_book(result.book)[result.chapter - 1][result.verse - 1]
