#!/usr/bin/python
# -*- coding: utf-8 -*-

from source_formatting.html_parser import BaseHtmlTranslator

_PREFIXES_TO_STRIP = (
    "גמ'",
    "מתני'",
)

class CommentaryPrefixStripper(BaseHtmlTranslator):
    def __init__(self):
        super().__init__()
        self.has_processed_text = False

    def handle_starttag(self, tag, attrs):
        self._out.append("<%s" % tag)
        for attr in attrs:
            self._out.append(f' {attr[0]}="{attr[1]}"')
        self._out.append(">")

    def handle_endtag(self, tag):
        self._out.append("</%s>" % tag)

    def handle_data(self, data):
        if not self.has_processed_text:
            for prefix in _PREFIXES_TO_STRIP:
                prefix = f"{prefix} "
                if data.startswith(prefix):
                    data = data[len(prefix):]
            self.has_processed_text = True
        self._out.append(data)
