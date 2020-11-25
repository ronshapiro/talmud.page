#!/usr/bin/python
# -*- coding: utf-8 -*-

from source_formatting.html_parser import BaseHtmlTranslator

class CommentaryParenthesesTransformer(BaseHtmlTranslator):
    english_name_ignore = ("Steinsaltz", "Shulchan Arukh", "Mishneh Torah")

    def __init__(self):
        super().__init__()

    def handle_starttag(self, tag, attrs):
        self.append_start_tag(tag, attrs)

    def handle_endtag(self, tag):
        self.append_end_tag(tag)

    def handle_data(self, data):
        self._out.append(
            data.replace('(', '<span class="parenthesized">(').replace(')', ')</span>'))
