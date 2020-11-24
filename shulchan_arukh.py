from source_formatting.html_parser import BaseHtmlTranslator
import json
import re
import requests

OC_SIMANIM = 697
YD_SIMANIM = 403
EH_SIMANIM = 178
CM_SIMANIM = 427

TITLE_PATTERN = r"[א-ת,\. '\"\(\)\[\]]+"

SEIFIM_OPTIONS = "|".join([
    r"סעיף א(חד)?", # sometimes just seif א
    r"סעיף אחר", # typo in Choshen Mishpat 23, also Choshen Mishpat 11, 318, 323
    r"סעיף א'", # seif alef'
    r"סעי' א'", # sei' alef'
    r"ט סעי'", # tet sei' - OC 51
    r'ס"א', # single seif abbreviation
    r"[א-ת'\"]* סעיפי[ם']", # multiple seifim. Seifim can be abbreviated leaving off the mem sofit
    r"[א-ת]+['\"]ס", # multiple seifim typo
    r"[א-ת]+ ס'", # multiple seifim with abbrevation
    r"סעיפים", # typo in Even HaEzer 80 where there is no seifim number listed
    r"ד בעיפים", # typo in Choshen Mishpat 83
    r"ד'סעיפים", # typo in Yoreh Deah 393
    r'כ"ב: סעיפים' # typo on Yoreh Deah 245
])

UVO = "|".join([
    "ובו",
    "והו", # YD 174
    "וסעיף" # YD 222
])
SEIFIM_PATTERN = rf"({UVO}) ({SEIFIM_OPTIONS})"

# Could end with a colon, period, and could have a space after it. And Choshen Mishpat 216 has a
# trailing apostrophe
TITLE_END = r"[:\.]? ?'?"

TITLE_RE = re.compile(rf"({TITLE_PATTERN})\.?:? {SEIFIM_PATTERN}{TITLE_END}")
TITLE_PREFIX = re.compile(rf"({TITLE_PATTERN})\.?:? ובו (.*)")


class HtmlExtractor(BaseHtmlTranslator):
    ongoing = True
    tag_stack = []

    def handle_starttag(self, tag, attrs):
        self.tag_stack.append(tag)

    def handle_endtag(self, tag):
        if tag == "b":
            self.ongoing = False
        self.tag_stack.pop()

    def handle_data(self, data):
        if self.ongoing and self.tag_stack[-1] == "b":
            self._out.append(data)


def get_title(section, siman):
    response = requests.get(
        f"https://www.sefaria.org/api/texts/Shulchan_Arukh,_{section.replace(' ', '_')}.{siman}")
    first_segment = ""
    try:
        first_segment = response.json()["he"][0]
    except: # noqa E722
        print(f"Error on {section} {siman}")
        return
    first_segment = HtmlExtractor.process(first_segment)
    match = TITLE_RE.match(first_segment)
    if match:
        return match.group(1)

    if section == "Choshen Mishpat" and siman == 418:
        # This doesn't have the word ובו and adding that complication into the regex is
        # unnecesarily complicated. Sticking it here in the case that the text is fixed and matches
        # a future version
        return "נזקי האש פטורו וחיובו וטמון באש וכל דיניו"

    print(siman)
    if TITLE_PREFIX.match(first_segment):
        print("matches prefix!")
        print(f"{TITLE_PREFIX.match(first_segment).groups()[-1]}|end")

    print(first_segment[:400])


def get_titles(section, simanim):
    results = {}
    for i in range(1, simanim + 1):
        results[str(i)] = get_title(section, i)
    return results

all_results = {
    "Orach Chayim": get_titles("Orach Chayim", OC_SIMANIM),
    "Yoreh De'ah": get_titles("Yoreh De'ah", YD_SIMANIM),
    "Choshen Mishpat": get_titles("Choshen Mishpat", CM_SIMANIM),
    "Even HaEzer": get_titles("Even HaEzer", EH_SIMANIM),
}

with open("precomputed_texts/shulchan_arukh_headings.json", "w+") as f:
    f.write(
        json.dumps(
            all_results,
            ensure_ascii = False,
            indent = 2,
            sort_keys = True))
    f.write("\n")


# for i in [22, 29, 417, 419, 430, 486, 530, 596, 598, 599, 603, 625, 642, 655, 657, 661, 679, 683]:
#     get_title("Orach Chayim", i)
# get_titles("Orach Chayim", OC_SIMANIM)
# for i in [168, 180, 225, 230, 260, 261, 304]:
#     get_title("Yoreh De'ah", i)
# get_titles("Yoreh De'ah", YD_SIMANIM)
#  YD 169 has no text
# for i in [180, 274, 350, 352]:
#     get_title("Choshen Mishpat", i)
# get_titles("Choshen Mishpat", CM_SIMANIM)
# get_titles("Even HaEzer", EH_SIMANIM)
