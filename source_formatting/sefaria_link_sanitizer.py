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
        self._out.append("<%s" % tag)
        for attr in attrs:
            self._out.append(' %s="%s"' %(attr[0], attr[1]))
        self._out.append(">")

    def handle_endtag(self, tag):
        if tag == "a":
            return
        self._out.append("</%s>" % tag)

    def handle_data(self, data):
        # TODO: perhaps keeping these html encodings is fine.
        # Jastrow on Sefaria doesn't use them for whatever reason.
        self._out.append(html.escape(data).replace("&apos;", "׳").replace("&quot;", '"'))
