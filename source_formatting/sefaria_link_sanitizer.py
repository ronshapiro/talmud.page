from source_formatting.html_parser import BaseHtmlTranslator
import html

class SefariaLinkSanitizer(BaseHtmlTranslator):
    def _process_string(self, text):
        text = text.replace("&nbsp;", "__nbsp__")
        text = super()._process_string(text)
        return text.replace("__nbsp__", "&nbsp;")

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            return
        self.append_start_tag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == "a":
            return
        self.append_end_tag(tag)

    def handle_data(self, data):
        # The extra encodings may not be necessary, but it can't hurt..
        # FWIW Jastrow on Sefaria doesn't use them for whatever reason.
        self._out.append(html.escape(data).replace("&apos;", "׳").replace("&quot;", '"'))
