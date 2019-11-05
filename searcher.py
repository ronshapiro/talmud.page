#!/usr/bin/python
# -*- coding: utf-8 -*-

from books import Books
from result_types import SearchResult, UiResult
import re

ALL_BOOKS = (
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    
    "Amos", "Ezekiel", "Habakkuk", "Haggai", "Hosea", "I Kings", "I Samuel",
    "II Kings", "II Samuel", "Isaiah", "Jeremiah", "Joel", "Jonah", "Joshua",
    "Judges", "Malachi", "Micah", "Nahum", "Obadiah", "Zechariah", "Zephaniah",
    
    "Daniel", "Ecclesiastes", "Esther", "Ezra", "I Chronicles", "II Chronicles",
    "Job", "Lamentations", "Nehemiah", "Proverbs", "Psalms", "Ruth",
    "Song of Songs"
)

ALL_VOWELS_RE = u"[֑-ׇ]*"

def _matching_indices(source, regex):
    start_index = 0
    result = []
    
    while True:
        match = regex.search(source, start_index)
        if match:
            result.append((match.start(), match.end()))
            start_index = match.end()
        else:
            break

    return result

class Searcher(object):
    def __init__(self):
        self.books = Books()

    def _search_book(self, book, vocalized_regex):
        search_results = []
        text = self.books.vocalized(book)
        for c, chapter in enumerate(text):
            for v, verse in enumerate(chapter):
                matches = _matching_indices(verse, vocalized_regex)
                if len(matches) > 0:
                    result = SearchResult(book = book,
                                          chapter = c+1,
                                          verse = v+1,
                                          vocalized_indices = matches)
                    search_results.append(result)
        return search_results

    def bolded_search_results(self, search_word):
        vocalized_regex = re.compile(ALL_VOWELS_RE.join(list(search_word)))
        ui_results = []
        i = 0
        for book in ALL_BOOKS:
            for search_result in self._search_book(book, vocalized_regex):
                ui_results.append(UiResult(
                    title = "%s %s:%s" % (
                        search_result.book, search_result.chapter, search_result.verse),
                    hebrew = self._boldify_vocalized_text(search_result),
                    english = self.books.english_verse(search_result),
                    link = "https://www.sefaria.org/%s.%s.%s?lang=bi" % (
                        search_result.book, search_result.chapter, search_result.verse),
                    result_id = i,
                ))
                i += 1
        return ui_results
    
    def _boldify(self, text):
        return "<b>%s</b>" % (text)
    
    def _boldify_vocalized_text(self, search_result):
        vocalized = self.books.vocalized_verse(search_result)
        formatted_verse_parts = []
        last_copied_index = 0
        finished = False
        for match_index in search_result.vocalized_indices:
            bolded_index_start = vocalized.rfind(u" ", 0, match_index[0])
            bolded_index_end = vocalized.find(u" ", match_index[1])
            if bolded_index_start is -1:
                formatted_verse_parts.append(self._boldify(vocalized[:bolded_index_end]))
                formatted_verse_parts.append(" ")
            elif bolded_index_end is -1:
                formatted_verse_parts.append(vocalized[last_copied_index : bolded_index_start + 1])
                formatted_verse_parts.append(self._boldify(vocalized[bolded_index_start + 1:]))
                finished = True
            else:
                formatted_verse_parts.append(vocalized[last_copied_index : bolded_index_start + 1])
                formatted_verse_parts.append(self._boldify(vocalized[bolded_index_start + 1 : bolded_index_end]))
            last_copied_index = bolded_index_end

        if not finished:
            formatted_verse_parts.append(vocalized[last_copied_index:])

        return u"".join(formatted_verse_parts)
