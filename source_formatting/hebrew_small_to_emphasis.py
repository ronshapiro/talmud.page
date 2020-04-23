#!/usr/bin/python
# -*- coding: utf-8 -*-

from source_formatting.html_parser import BaseHtmlTranslator

class HebrewSmallToEmphasisTagTranslator(BaseHtmlTranslator):
    def handle_starttag(self, tag, attrs):
        if tag == "small":
            self._out.append('<span class="hebrew-emphasis">')
            return
        self._out.append("<%s" % tag)
        for attr in attrs:
            self._out.append(' %s="%s"' %(attr[0], attr[1]))
        self._out.append(">")

    def handle_endtag(self, tag):
        if tag == "small":
            tag = "span"
        self._out.append("</%s>" % tag)

    def handle_data(self, data):
        self._out.append(data)
