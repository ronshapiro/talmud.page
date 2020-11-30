#!/usr/bin/python
# -*- coding: utf-8 -*-

from enum import Enum
from hadran import hadran_sections
from hebrew import strip_hebrew_nonletters
from source_formatting.commentary_parentheses import CommentaryParenthesesTransformer
from source_formatting.commentary_prefixes import CommentaryPrefixStripper
from source_formatting.dibur_hamatchil import bold_diburei_hamatchil
from source_formatting.hebrew_small_to_emphasis import HebrewSmallToEmphasisTagTranslator
from source_formatting.image_numbering import ImageNumberingFormatter
from source_formatting.jastrow import JastrowReformatter
from source_formatting.otzar_laazei_rashi import format_otzar_laazei_rashi
from source_formatting.section_symbol import SectionSymbolRemover
from source_formatting.sefaria_link_sanitizer import SefariaLinkSanitizer
from source_formatting.shulchan_arukh_remove_header import ShulchanArukhHeaderRemover
import asyncio
import httpx
import re
import masechtot

_ALEPH = "א"
_TAV = "ת"
_STEINSALTZ_SUGYA_START = re.compile("^<big>[%s-%s]" % (_ALEPH, _TAV))

class RealRequestMaker(object):
    async def request_amud(self, ref):
        # It seems like the http client should be cached, but that causes errors with the event
        # loop. The httpx documentation mentions that the main benefits here are connection pooling,
        # which would be nice since we connect to the same host repeatedly. But because there's a
        # response cache in server.py, it's not an urgent peformance issue.
        async with httpx.AsyncClient() as client:
            return await client.get(
                # https://github.com/Sefaria/Sefaria-Project/wiki/API-Documentation
                f"https://sefaria.org/api/texts/{ref}",
                params = {
                    "commentary": "1",
                    # This shouldn't have a difference for the Gemara reqeusts, but it does expand
                    # the Rashi/Tosafot requests to have the entire amud's worth of commentary
                    "pad": "0",
                    # Even with wrapLinks=1, Jastrow (and perhaps more) is still wrapped. Instead,
                    # an active filtering is performed just in case.
                    "wrapLinks": "0",
                })

def standard_english_transformations(english):
    return SectionSymbolRemover.process(SefariaLinkSanitizer.process(english))


_HADRAN_PATTERN = re.compile("^(<br>)+<big><strong>הדרן עלך .*")

def is_hadran(text):
    return len(_HADRAN_PATTERN.findall(strip_hebrew_nonletters(text))) > 0


class AbstractApiRequestHandler(object):
    def __init__(self, request_maker, print_function=print):
        self._request_maker = request_maker
        self._print = print_function

    def _make_requests(self, *args):
        raise NotImplementedError()

    def _make_id(self, *args):
        raise NotImplementedError()

    def _make_sub_ref(self, main_ref, index):
        return f"{main_ref}.{index + 1}"

    def _section_splitter(self):
        return ":"

    def _translate_hebrew_text(self, text):
        return text

    def _translate_english_text(self, text):
        return standard_english_transformations(text)

    def _post_process_section(self, section):
        return section

    def _post_process_all_sections(self, sections, *args):
        return sections

    def handle_request(self, *args):
        sefaria_results = asyncio.run(self._make_requests(*args))

        bad_results = list(filter(lambda x: x.status_code != 200, sefaria_results))
        def _raise_bad_results_exception():
            raise ApiException(
                "\n".join(map(lambda x: x.text, bad_results)),
                500,
                ApiException.SEFARIA_HTTP_ERROR)
        if bad_results:
            _raise_bad_results_exception()

        try:
            results_as_json = list(map(lambda x: x.json(), sefaria_results))
        except Exception:
            _raise_bad_results_exception()

        main_json = results_as_json[0]

        result = {
            "id": self._make_id(*args),
            "title": main_json.get("title", main_json["indexTitle"])
        }

        main_ref = main_json["ref"]
        hebrew = main_json["he"]
        english = main_json["text"]

        # https://github.com/Sefaria/Sefaria-Project/issues/543
        if len(hebrew) - 1 == len(english) and is_hadran(hebrew[-1]):
            english.append("")

        if len(hebrew) != len(english):
            extra = hebrew[len(english):] + english[len(hebrew):]
            self._print("Unmatched text/translation: ", extra)
            raise ApiException(
                "Hebrew length != English length",
                500,
                ApiException.UNEQAUL_HEBREW_ENGLISH_LENGTH)

        sections = []
        for i in range(len(hebrew)):
            sections.append({
                "he": self._translate_hebrew_text(hebrew[i]),
                "en": self._translate_english_text(english[i]),
                "ref": self._make_sub_ref(main_ref, i),
                "commentary": Commentary.create(),
            })

        section_prefix = f"{main_ref}{self._section_splitter()}"
        for comment in main_json["commentary"]:
            self._add_comment_to_result(comment, sections, section_prefix)

        for secondary_json in results_as_json[1:]:
            self._add_second_level_comments_to_result(secondary_json, sections)

        sections = list(map(self._post_process_section, sections))

        sections = self._post_process_all_sections(sections, *args)
        if len(sections) == 0:
            self._print(f"No sections for {', '.join(args)}")

        for section in sections:
            if "commentary" in section and type(section["commentary"]) == Commentary:
                section["commentary"] = section["commentary"].to_dict()

        result["sections"] = sections
        return result

    def _add_comment_to_result(self, comment, sections, section_prefix):
        if len(comment["he"]) == 0 and \
           len(comment["text"]) == 0:
            return

        matching_commentary_kind = _matching_commentary_kind(comment)
        if not matching_commentary_kind:
            return

        section = self._find_matching_section_index(comment, section_prefix)
        if section is None or section >= len(sections):
            self._print("Unplaceable comment:", comment["sourceRef"], comment["anchorRefExpanded"])
            return

        sections[section]["commentary"].add_comment(
            Comment.create(comment, matching_commentary_kind["englishName"]))

    def _find_matching_section_index(self, comment, section_prefix):
        if "anchorRefExpanded" not in comment:
            return
        # TODO: question: if this spans multiple sections, is placing it in the first always
        # correct?
        # TODO: if the comment spans multiple pages, this could place it at the first mentioned
        # section in the first page, and then duplicate it at the first section in the following
        # page
        for anchor in comment["anchorRefExpanded"]:
            if anchor.startswith(section_prefix):
                return int(anchor.split(self._section_splitter())[1]) - 1

    def _add_second_level_comments_to_result(self, secondary_api_response, sections):
        if "commentary" not in secondary_api_response:
            return

        section_prefix = f"{secondary_api_response['ref']}:",
        first_level_commentary_name = f"{secondary_api_response['commentator']}"
        for comment in secondary_api_response.get("commentary", []):
            self._add_second_level_comment_to_result(
                comment, sections, section_prefix, first_level_commentary_name)

    def _add_second_level_comment_to_result(
            self, comment, sections, section_prefix, first_level_commentary_name):
        section = self._find_matching_section_index(comment, section_prefix)

        if section is None or section >= len(sections):
            self._print("Unplaceable second level comment:",
                        comment["sourceRef"],
                        comment["anchorRefExpanded"],
                        comment["type"],
                        comment["category"])
            return

        matching_commentary_kind = _matching_commentary_kind(comment)
        if not matching_commentary_kind:
            return

        result = sections[section]["commentary"].add_nested_comment(
            first_level_commentary_name,
            Comment.create(comment, matching_commentary_kind["englishName"]))
        if not result:
            self._print("Unplaceable second level comment:",
                        comment["sourceRef"],
                        comment["anchorRefExpanded"],
                        comment["type"],
                        comment["category"])


# TODO: rename this to be Gemara related
class ApiRequestHandler(AbstractApiRequestHandler):
    async def _make_requests(self, masechet, amud):
        return await asyncio.gather(
            self._request_maker.request_amud(f"{masechet}.{amud}"),
            self._request_maker.request_amud(f"Rashi_on_{masechet}.{amud}"),
            self._request_maker.request_amud(f"Tosafot_on_{masechet}.{amud}"),
        )

    # TODO: remove name alias
    def amud_api_request(self, masechet, amud):
        return self.handle_request(masechet, amud)

    def _make_id(self, masechet, amud):
        return amud

    def _post_process_section(self, section):
        self._resolve_duplicated_out_and_nested_comments(section)

        for comment in section["commentary"].comments:
            if comment.english_name == "Steinsaltz" and \
               _STEINSALTZ_SUGYA_START.findall(comment.hebrew):
                section["steinsaltz_start_of_sugya"] = True

        if is_hadran(section["he"]):
            section["he"] = section["he"].replace("<br>", "")
            section["en"] = ""
            section["commentary"] = Commentary.create()
            section["hadran"] = True

        return section

    def _post_process_all_sections(self, sections, masechet, amud):
        if masechet == "Nazir" and amud == "33b":
            return [{
                "he": "אין גמרא לנזיר ל״ג ע״א, רק תוספות (שהם קשורים לדפים אחרים)",
                "en": "Nazir 33b has no Gemara, just Tosafot (which are linked to other pages).",
                "commentary": Commentary.create(),
                "ref": "synthetic",
            }]

        if masechtot.MASECHTOT_BY_CANONICAL_NAME[masechet].end == amud:
            sections += hadran_sections(masechet)
        return sections

    def _resolve_duplicated_out_and_nested_comments(self, section):
        commentary = section["commentary"]
        top_level_comments_by_ref = {comment.ref: comment for comment in commentary.comments}
        for nested_commentary_name, nested_commentary in commentary.nested_commentaries.items():
            for nested_comment in nested_commentary.comments:
                top_level_comment = top_level_comments_by_ref.get(nested_comment.ref)
                if not top_level_comment:
                    continue
                removal_strategy = self._removal_strategy(top_level_comment, nested_comment)
                if removal_strategy is RemovalStrategy.REMOVE_TOP_LEVEL:
                    commentary.remove_comment_with_ref(top_level_comment.ref)
                elif removal_strategy is RemovalStrategy.REMOVE_NESTED:
                    nested_commentary.remove_comment_with_ref(nested_comment.ref)

    def _removal_strategy(self, top_level_comment, nested_comment):
        if top_level_comment.english_name == "Verses":
            # TODO: consider not removing these, as verses are typically shorter, and duplicates
            # can be useful
            return RemovalStrategy.REMOVE_NESTED
        # TODO: it would be great to define this in _COMMENTARIES if possible so that all metadata
        # for commentaries is defined in one location.
        elif nested_comment.english_name in (
                "Maharsha", "Maharshal", "Meir Lublin", "Otzar Laazei Rashi"):
            return RemovalStrategy.REMOVE_TOP_LEVEL

        self._print("Duplicated comment (Ref: %s) on %s and %s" % (
            top_level_comment.ref, top_level_comment.source_ref, nested_comment.ref))


class RemovalStrategy(Enum):
    REMOVE_TOP_LEVEL = 1
    REMOVE_NESTED = 2


parse_masechtot = masechtot.Masechtot().parse

def _masechet_ref(ref):
    for masechet in masechtot.MASECHTOT_BY_CANONICAL_NAME.keys():
        if ref.startswith(masechet):
            return parse_masechtot(ref.split(":")[0])

def strip_ref_segment_number(ref):
    if ":" not in ref:
        return ref

    return ref[0:ref.index(":")]

def strip_ref_quotation_marks(ref):
    parts = ref.split(" ")
    last_part = parts.pop()
    if ":" not in last_part:
        return ref

    parts.append(last_part.replace("׳", "").replace("״", ""))
    return " ".join(parts)


SHULCHAN_ARUKH_HEADERS = {}
with open("precomputed_texts/shulchan_arukh_headings.json", "r") as f:
    import json
    SHULCHAN_ARUKH_HEADERS = json.load(f)

class Comment(object):
    """Represents a single comment on a text.
    """

    @staticmethod
    def create(sefaria_comment, english_name):
        hebrew = sefaria_comment["he"]
        english = sefaria_comment["text"]
        if hebrew == english:
            # Fix an issue where sometimes Sefaria returns the exact same text. For now, safe to
            # assume that the equivalent text is Hebrew.
            # TODO: this may no longer happen anymore
            english = ""

        if english_name == "Otzar Laazei Rashi":
            hebrew = format_otzar_laazei_rashi(hebrew)

        hebrew = bold_diburei_hamatchil(hebrew, english_name)
        for processor in [
                HebrewSmallToEmphasisTagTranslator,
                CommentaryPrefixStripper,
                CommentaryParenthesesTransformer,
                ImageNumberingFormatter]:
            hebrew = processor.process(hebrew, english_name=english_name)

        english = standard_english_transformations(english)
        if english_name == "Jastrow":
            english = JastrowReformatter.process(english)

        comment = Comment()

        comment.hebrew = hebrew
        comment.english = english
        comment.ref = sefaria_comment["ref"]
        comment.source_ref = sefaria_comment["sourceRef"]
        comment.source_he_ref = sefaria_comment["sourceHeRef"]

        masechet_ref = _masechet_ref(comment.source_ref)
        if english_name == "Mesorat Hashas" and masechet_ref:
            comment.source_ref = strip_ref_segment_number(comment.source_ref)
            comment.source_he_ref = strip_ref_segment_number(comment.source_he_ref)
            comment.talmud_page_link = masechet_ref.to_url_pathname()
        else:
            comment.source_he_ref = strip_ref_quotation_marks(comment.source_he_ref)
            comment.talmud_page_link = None
        comment.english_name = english_name

        comment.subtitle = None
        if english_name == "Shulchan Arukh":
            book, chapter = comment.ref.split("Shulchan Arukh, ")[1].split(":")[0].rsplit(" ", 1)
            subtitle = SHULCHAN_ARUKH_HEADERS[book][chapter]
            if subtitle:
                comment.source_he_ref = f"{comment.source_he_ref} - {subtitle}"
                if comment.ref.endswith(":1"):
                    comment.hebrew = ShulchanArukhHeaderRemover.process(comment.hebrew)

        return comment

    def to_dict(self):
        as_dict = {
            "he": self.hebrew,
            "en": self.english,
            "ref": self.ref,
            "sourceRef": self.source_ref,
            "sourceHeRef": self.source_he_ref,
        }
        if self.talmud_page_link:
            as_dict["link"] = self.talmud_page_link
        return as_dict

class Commentary(object):
    """Maintains the state of all comments on a particular section.
    """

    def create():
        commentary = Commentary()
        commentary.comments_by_ref = {}
        commentary.comments = []
        commentary.nested_commentaries = {}
        return commentary

    def add_comment(self, comment):
        if comment.ref in self.comments_by_ref:
            return
        self.comments_by_ref[comment.ref] = True

        self.comments.append(comment)

    def add_nested_comment(self, parent_commentary_name, comment):
        if not any(map(lambda x: x.english_name == parent_commentary_name, self.comments)):
            return False
        if parent_commentary_name not in self.nested_commentaries:
            self.nested_commentaries[parent_commentary_name] = Commentary.create()
        self.nested_commentaries[parent_commentary_name].add_comment(comment)
        return True

    def remove_comment_with_ref(self, ref):
        self.comments = list(filter(lambda x: x.ref != ref, self.comments))

    def to_dict(self):
        result = {}
        for comment in self.comments:
            if comment.english_name not in result:
                result[comment.english_name] = {}
                result[comment.english_name]["comments"] = []
            result[comment.english_name]["comments"].append(comment.to_dict())
        for english_name, nested_commentary in self.nested_commentaries.items():
            nested_commentary_value = nested_commentary.to_dict()
            if nested_commentary_value:
                result[english_name]["commentary"] = nested_commentary_value
        return result


class ApiException(Exception):
    SEFARIA_HTTP_ERROR = 1,
    UNEQAUL_HEBREW_ENGLISH_LENGTH = 2

    def __init__(self, message, http_status, internal_code):
        super().__init__(message)
        self.message = message
        self.http_status = http_status
        self.internal_code = internal_code

# TODO: Sync commentaries data and expose it as a route as a JS file
_COMMENTARIES = [
    {
        "englishName": "Translation",
    },
    {
        "englishName": "Verses",
        "category": "Tanakh",
    },
    {
        "englishName": "Mishnah",
        "category": "Mishnah",
    },
    {
        "englishName": "Tosefta",
        "englishNamePattern": re.compile("^Tosefta "),
    },
    {
        "englishName": "Rashi",
    },
    {
        "englishName": "Otzar Laazei Rashi",
    },
    {
        "englishName": "Tosafot",
    },
    {
        "englishName": "Rabbeinu Chananel",
        "englishNamePattern": re.compile("^Rabbeinu Chananel on .*"),
    },
    {
        "englishName": "Ramban",
    },
    {
        "englishName": "Rashba",
    },
    {
        "englishName": "Rashbam",
    },
    {
        "englishName": "Maharsha",
        "englishNamePattern": re.compile("(Chidushei Halachot|Chidushei Agadot)"),
    },
    {
        "englishName": "Maharshal",
        "englishNamePattern": re.compile("(Chokhmat Shlomo on .*|Chokhmat Shlomo)"),
    },
    {
        "englishName": "Meir Lublin",
        "englishNamePattern": re.compile("^Maharam$"),
    },
    {
        "englishName": "Rosh",
        "englishNamePattern": re.compile("^Rosh on "),
    },
    {
        "englishName": "Ritva",
    },
    {
        "englishName": "Rav Nissim Gaon",
        "englishNamePattern": re.compile("^Rav Nissim Gaon on "),
    },
    {
        "englishName": "Shulchan Arukh",
        "englishNamePattern": re.compile("^Shulchan Arukh, "),
    },
    {
        "englishName": "Mishneh Torah",
        "englishNamePattern": re.compile("^Mishneh Torah, "),
    },
    #  {
    #    "englishName": "Sefer Mitzvot Gadol",
    #  },
    {
        "englishName": "Mesorat Hashas",
        "type": "mesorat hashas",
    },
    {
        "englishName": "Jastrow",
    },
    {
        "englishName": "Steinsaltz",
    }
]

def _has_matching_property(first, second, property_name):
    return property_name in first and \
        property_name in second and \
        first[property_name] == second[property_name]

def _matching_commentary_kind(comment):
    name = comment["collectiveTitle"]["en"]
    for kind in _COMMENTARIES:
        if name == kind["englishName"] or \
           _has_matching_property(comment, kind, "category") or \
           _has_matching_property(comment, kind, "type") or \
           "englishNamePattern" in kind and kind["englishNamePattern"].findall(name):
            return kind
