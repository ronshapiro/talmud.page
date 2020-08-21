#!/usr/bin/python
# -*- coding: utf-8 -*-

from source_formatting.html_parser import BaseHtmlTranslator

class ImageNumberingFormatter(BaseHtmlTranslator):
    def __init__(self):
        super().__init__()
        self.image_tags = []
        self.has_processed_text = False
        self.is_in_image = False

    def handle_starttag(self, tag, attrs):
        if tag == "img":
            new_tag = []
            self.append_start_tag(tag, attrs, to=new_tag)
            self.image_tags.append("".join(new_tag))
            self._out.append(None)
        else:
            self.append_start_tag(tag, attrs)

    def handle_endtag(self, tag):
        self.append_end_tag(tag)

    def handle_data(self, data):
        self._out.append(data)

    def format_image_ref(self, counter):
        if counter == 1 and len(self.image_tags) == 1:
            return "(*)"
        else:
            return f"({counter})"

    def before_join(self):
        if len(self.image_tags) == 0:
            return

        new_out = []
        image_counter = 0
        for piece in self._out:
            if piece:
                new_out.append(piece)
            else:
                image_ref = self.format_image_ref(image_counter + 1)
                new_out += [
                    '<span class="image-ref-container">',
                    f'<span class="image-ref-text">{image_ref}:</span>',
                    '<span class="image-ref">',
                    self.image_tags[image_counter],
                    "</span>",
                    "</span>",
                    f'<span class="image-pointer">{image_ref}</span>',
                ]
                image_counter += 1
        self._out = new_out
