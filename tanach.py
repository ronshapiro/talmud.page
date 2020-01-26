#!/usr/bin/python
# -*- coding: utf-8 -*-

import json

BOOKS = (
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",

    "Amos", "Ezekiel", "Habakkuk", "Haggai", "Hosea", "I Kings", "I Samuel",
    "II Kings", "II Samuel", "Isaiah", "Jeremiah", "Joel", "Jonah", "Joshua",
    "Judges", "Malachi", "Micah", "Nahum", "Obadiah", "Zechariah", "Zephaniah",

    "Daniel", "Ecclesiastes", "Esther", "Ezra", "I Chronicles", "II Chronicles",
    "Job", "Lamentations", "Nehemiah", "Proverbs", "Psalms", "Ruth",
    "Song of Songs"
)


class Tanach(object):
    def __init__(self):
        # TODO: take approach like books.py.Source
        self.hebrew_cache = {}
        self.english_cache = {}

        self.hebrew = lambda book: \
                         self._load_if_necessary(self.hebrew_cache, "hebrew", book)
        self.english = lambda book: \
                       self._load_if_necessary(self.english_cache, "english", book)

        self.hebrew_verse = lambda result: self._verse(self.hebrew, result)
        self.english_verse = lambda result: self._verse(self.english, result)

    def _load_if_necessary(self, cache, folder, book):
        if book not in cache:
            file_name = "sefaria-data/bible/%s/%s.json" % (folder, book)
            cache[book] = json.load(open(file_name))["text"]
        return cache[book]

    # type(result) == SearchResult
    def _verse(self, _get_book, result):
        return _get_book(result.book)[result.chapter - 1][result.verse - 1]
