#!/usr/bin/python
# -*- coding: utf-8 -*-

from source_formatting.html_parser import BaseHtmlTranslator

class SectionSymbolRemover(BaseHtmlTranslator):
    def __init__(self):
        super().__init__()
        self._is_at_start = True

    def handle_starttag(self, tag, attrs):
        self.append_start_tag(tag, attrs)

    def handle_endtag(self, tag):
        self.append_end_tag(tag)

    def handle_data(self, data):
        if self._is_at_start:
            self._is_at_start = False
            data = data.replace("§ ", "")
        self._out.append(data)
