#!/usr/bin/python
# -*- coding: utf-8 -*-

import html
import html.parser

# TODO: extract base class for HTML Parsers

def reformat_hebrew_small_text(text_or_list):
    if type(text_or_list) == str:
        return _reformat(text_or_list)
    return tuple(map(_reformat, text_or_list))

def _reformat(text):
    sanitizer = _SteinsaltzReformatter()
    sanitizer.feed(text)
    return "".join(sanitizer._out)

class _SteinsaltzReformatter(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self._out = []

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
