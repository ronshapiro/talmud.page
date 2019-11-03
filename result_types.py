#!/usr/bin/python
# -*- coding: utf-8 -*-

class SearchResult(object):
    def __init__(self, book, chapter, verse, vocalized_indices):
        self.book = book
        self.chapter = chapter
        self.verse = verse
        self.vocalized_indices = vocalized_indices

    def __eq__(self, other):
        return (self.book == other.book and
                self.chapter == other.chapter and
                self.verse == other.verse and
                self.vocalized_indices == other.vocalized_indices
                )

    def __hash__(self):
        return hash((book, chapter, verse, vocalized_indices))

    def __str__(self):
        return "%s %s:%s" % (result.book, result.chapter, reult.verse)

class UiResult(object):
    def __init__(self, title, hebrew, english, link):
        self.title = title
        self.hebrew = hebrew
        self.english = english
        self.link = link

    def to_dict(self):
        return {"title": self.title,
                "hebrew": self.hebrew,
                "english": self.english,
                "link": self.link}
