#!/usr/bin/python

from source_formatting.html_parser import BaseHtmlTranslator

class ShulchanArukhHeaderRemover(BaseHtmlTranslator):
    tag_stack = []
    processing_header = False
    done_processing_header = False

    def handle_starttag(self, tag, attrs):
        if self.done_processing_header and tag == "br" and len(self.tag_stack) == 0:
            return

        self.tag_stack.append(tag)

        if not self.done_processing_header and tag == "b" and self.tag_stack == ["b"]:
            self.processing_header = True
            return

        if self.processing_header:
            return

        self.append_start_tag(tag, attrs)

    def handle_endtag(self, tag):
        self.tag_stack.pop()

        if not self.done_processing_header and tag == "b" and len(self.tag_stack) == 0:
            self.done_processing_header = True
            self.processing_header = False
            return

        if self.processing_header:
            return

        self.append_end_tag(tag)

    def handle_data(self, data):
        if self.processing_header:
            return
        self._out.append(data)
