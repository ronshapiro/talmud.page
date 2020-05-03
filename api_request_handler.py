#!/usr/bin/python
# -*- coding: utf-8 -*-

from source_formatting.jastrow import JastrowReformatter
from source_formatting.hebrew_small_to_emphasis import HebrewSmallToEmphasisTagTranslator
from source_formatting.dibur_hamatchil import bold_diburei_hamatchil
from source_formatting.sefaria_link_sanitizer import SefariaLinkSanitizer
import asyncio
import httpx
import re

HADRAN_PATTERN = re.compile("^(<br>)+<big><strong>הדרן עלך .*")
BR_PREFIX = re.compile("^(<br>)+")

class RealRequestMaker(object):
    async def request_amud(self, ref):
        # TODO: it seems like the http client should be cached, but that causes errors with the
        # event loop. httpx documents that the main benefits here are connection pooling, which
        # would be nice since we connect to the same host repeatedly.
        async with httpx.AsyncClient() as client:
            return await client.get(
                # https://github.com/Sefaria/Sefaria-Project/wiki/API-Documentation
                f"https://sefaria.org/api/texts/{ref}",
                params = {
                    "commentary": "1",
                    # Even with wrapLinks=1, Jastrow (and perhaps more) is still wrapped. Instead,
                    # an active filtering is performed just in case.
                    "wrapLinks": "0",
                    # This shouldn't have a difference for the Gemara reqeusts, but it does expand
                    # the Rashi/Tosafot requests to have the entire amud's worth of commentary
                    "pad": "0",
                })

class ApiRequestHandler(object):
    def __init__(self, request_maker, print_function=print):
        self._request_maker = request_maker
        self._print = print_function

    async def _make_requests(self, masechet, amud):
        return await asyncio.gather(
            self._request_maker.request_amud(f"{masechet}.{amud}"),
            self._request_maker.request_amud(f"Rashi_on_{masechet}.{amud}"),
            self._request_maker.request_amud(f"Tosafot_on_{masechet}.{amud}"),
        )

    def amud_api_request(self, masechet, amud):
        sefaria_results = asyncio.run(self._make_requests(masechet, amud))

        bad_results = list(filter(lambda x: x.status_code is not 200, sefaria_results))
        def _raise_bad_results_exception():
            raise ApiException("\n".join(map(lambda x: x.text, bad_results)), 500, 1)
        if bad_results:
            _raise_bad_results_exception()

        try:
            results_as_json = list(map(lambda x: x.json(), sefaria_results))
        except:
            _raise_bad_results_exception()

        result = {"id": amud}

        gemara_json, rashi_json, tosafot_json = results_as_json
        for i in ["title"]:
            result[i] = gemara_json[i]

        hebrew = gemara_json["he"]
        english = gemara_json["text"]

        # https://github.com/Sefaria/Sefaria-Project/issues/543
        if len(hebrew) - 1 == len(english) and "הדרן עלך" in hebrew[-1]:
            english.append("")
        # https://github.com/Sefaria/Sefaria-Project/issues/543#issuecomment-623061313
        elif len(hebrew) + 1 == len(english) and masechet == "Kiddushin" and amud == "22b":
            english = english[:-1]

        if len(hebrew) != len(english):
            raise ApiException("Hebrew length != English length", 500, 2)

        sections = []
        for i in range(len(hebrew)):
            sections.append({
                "he": hebrew[i],
                "en": SefariaLinkSanitizer.process(english[i]),
                "ref": "%s.%s" %(gemara_json["ref"], i + 1),
                "commentary": {},
                })

        section_prefix = "%s %s:" %(gemara_json["book"], amud)
        for comment in gemara_json["commentary"]:
            self._add_comment_to_result(comment, sections, section_prefix)
        rashi_section_prefix = f"Rashi on {section_prefix}"
        # TODO: figure our what pages don't have Rashi so we can make an assertion if Rashi
        # is _unexpectedly_ empty
        for comment in rashi_json.get("commentary", []):
            self._add_second_level_comment_to_result(
                comment, sections, rashi_section_prefix, "Rashi")
        tosafot_section_prefix = f"Tosafot on {section_prefix}"
        for comment in tosafot_json.get("commentary", []):
            self._add_second_level_comment_to_result(
                comment, sections, tosafot_section_prefix, "Tosafot")

        if len(sections):
            last_section = sections[len(sections) - 1]
            if HADRAN_PATTERN.findall(last_section["he"]):
                last_section["he"] = BR_PREFIX.sub("<br>", last_section["he"])
                last_section["en"] = ""
                last_section["commentary"] = {}
                last_section["hadran"] = True
        elif masechet == "Nazir" and amud == "33b":
            # TODO: return some useful text, potentially an Easter egg?
            pass # Nazir 33b has no Gemara, just Tosafot
        else:
            self._print(f"No sections for {masechet} {amud}")

        result["sections"] = sections
        return result

    def _add_comment_to_result(self, comment, sections, section_prefix):
        if len(comment["he"]) is 0 and \
           len(comment["text"]) is 0:
            return

        matching_commentary_kind = _matching_commentary_kind(comment)
        if not matching_commentary_kind:
            return

        section = self._find_matching_section_index(comment, section_prefix)
        if section is None or section >= len(sections):
            self._print("Unplaceable comment:", comment["sourceRef"], comment["anchorRefExpanded"])
            return

        commentary_dict = sections[section]["commentary"]

        english_name = matching_commentary_kind["englishName"]
        if english_name not in commentary_dict:
            commentary_dict[english_name] = {"comments": []}

        commentary_dict[english_name]["comments"].append(
            self._make_comment_json(comment, english_name))

    def _find_matching_section_index(self, comment, section_prefix):
        if "anchorRefExpanded" not in comment:
            return
        # TODO: question: if this spans multiple sections, is placing it in the first always correct?
        for anchor in comment["anchorRefExpanded"]:
            if anchor.startswith(section_prefix):
                return int(anchor.split(":")[1]) - 1

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

        if first_level_commentary_name not in sections[section]["commentary"]:
            self._print("Unplaceable second level comment:",
                  comment["sourceRef"],
                  comment["anchorRefExpanded"],
                  comment["type"],
                  comment["category"])
            return

        first_level_commentary = sections[section]["commentary"][first_level_commentary_name]

        if "commentary" not in first_level_commentary:
            first_level_commentary["commentary"] = {}
        second_level_commentaries = first_level_commentary["commentary"]

        english_name = matching_commentary_kind["englishName"]
        if english_name not in second_level_commentaries:
            second_level_commentaries[english_name] = {"comments": []}

        second_level_commentaries[english_name]["comments"].append(
            self._make_comment_json(comment, english_name))


    def _make_comment_json(self, comment, english_name):
        hebrew = comment["he"]
        english = comment["text"]
        if hebrew == english:
            # Fix an issue where sometimes Sefaria returns the exact same text. For now, safe to
            # assume that the equivalent text is Hebrew.
            # TODO: this may no longer happen anymore
            english = ""

        hebrew = HebrewSmallToEmphasisTagTranslator.process(hebrew)
        hebrew = bold_diburei_hamatchil(hebrew, english_name)
        english = SefariaLinkSanitizer.process(english)
        if english_name == "Jastrow":
            english = JastrowReformatter.process(english)

        return {
            "he": hebrew,
            "en": english,
            "ref": comment["ref"],
            "sourceRef": comment["sourceRef"],
            "sourceHeRef": comment["sourceHeRef"],
        }


class ApiException(Exception):
    # TODO make constants for internal code
    def __init__(self, message, http_status, internal_code):
        super().__init__(message)
        self.message = message
        self.http_status = http_status
        self.internal_code = internal_code


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
        "englishName": "Tosafot",
    },
    {
        "englishName": "Ramban",
    },
    {
        "englishName": "Rashba",
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
];

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
