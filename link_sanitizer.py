import html
import html.parser

def sanitize_sefaria_links(text_or_list):
    if type(text_or_list) == type([]):
        return tuple(map(_sanitize, text_or_list))
    return _sanitize(text_or_list)

def _sanitize(text):
    text = text.replace("&nbsp;", "__nbsp__")
    sanitizer = _SefariaLinkSanitizer()
    sanitizer.feed(text)
    return "".join(sanitizer._out).replace("__nbsp__", "&nbsp;")

class _SefariaLinkSanitizer(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self._out = []

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
