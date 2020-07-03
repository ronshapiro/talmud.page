#!/usr/bin/python
# -*- coding: utf-8 -*-

from source_formatting.html_parser import BaseHtmlTranslator

class HebrewSmallToEmphasisTagTranslator(BaseHtmlTranslator):
    def handle_starttag(self, tag, attrs):
        if tag == "small":
            tag = "span"
            attrs = [("class", "hebrew-emphasis")]
        self.append_start_tag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == "small":
            tag = "span"
        self.append_end_tag(tag)

    def handle_data(self, data):
        self._out.append(data)
