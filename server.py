#!/usr/bin/python
# -*- coding: utf-8 -*-

from books import Books
from flask import Flask
from flask import jsonify
from flask import redirect
from flask import render_template as flask_render_template
from flask import request
from flask import send_file
from flask import url_for
from link_sanitizer import sanitize_sefaria_links
import datetime
import json
import os
import random
import re
import requests
import string
import uuid

random_hash = ''.join(random.choice(string.ascii_letters) for i in range(7))
app = Flask(__name__)
books = Books()

def _read_json_file(path):
    with open(path, "r") as f:
        return json.load(f)

BIBLICAL_INDEX = None
COMMENTARY_INDEX = None

MULTIPLE_SPACES = re.compile("  +")
AMUD_ALEPH_PERIOD = re.compile("(\d)\\.")
AMUD_BET_COLON = re.compile("(\d):")

AMUD_PATTERN = "\d{1,3}[ab\.:]"
# TODO: check arbitrary whitespace
MASECHET_WITH_AMUD = re.compile("(.*?) (%s)" % (AMUD_PATTERN))
MASECHET_WITH_AMUD_RANGE = re.compile("(.*?) (%s)( to |-| - )(%s)" % (AMUD_PATTERN, AMUD_PATTERN))

HADRAN_PATTERN = re.compile("^(<br>)+<big><strong>הדרן עלך .*")
BR_PREFIX = re.compile("^(<br>)+")

def render_template(template_name, **extra_template_variables):
    return flask_render_template(
        template_name,
        random_hash=random_hash,
        debug=app.debug,
        **extra_template_variables)

@app.route("/")
def homepage():
    return render_template("homepage.html")

def _canonical_amud_format(amud):
    return AMUD_ALEPH_PERIOD.sub(
        "\\1a",
        AMUD_BET_COLON.sub("\\1b", amud))

@app.route("/view_daf", methods = ["POST"])
def search_handler():
    term = request.form["search_term"].strip()
    term = MULTIPLE_SPACES.sub(" ", term)

    masechet_with_amud_range = MASECHET_WITH_AMUD_RANGE.match(term)
    if masechet_with_amud_range:
        masechet = masechet_with_amud_range.group(1)
        start = masechet_with_amud_range.group(2)
        end = masechet_with_amud_range.group(4)
        return redirect(url_for("amud_range",
                                masechet = books.canonical_masechet_name(masechet),
                                start = _canonical_amud_format(start),
                                end = _canonical_amud_format(end)))

    masechet_with_amud = MASECHET_WITH_AMUD.match(term)
    if masechet_with_amud:
        masechet = masechet_with_amud.group(1)
        amud = masechet_with_amud.group(2)
        # TODO: should canonicalizations happen in the request handlers themselves?
        return redirect(url_for("amud",
                                masechet = books.canonical_masechet_name(masechet),
                                amud = _canonical_amud_format(amud)))

    # TODO: proper error page
    # TODO: verify daf exists
    raise KeyError(term)

@app.route("/<masechet>/<amud>")
def amud(masechet, amud):
    canonical_masechet = books.canonical_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for("amud", masechet = canonical_masechet, amud = amud))
    return render_template(
        "talmud_page.html", title = "%s %s" %(masechet, amud))

@app.route("/<masechet>/<start>/to/<end>")
def amud_range(masechet, start, end):
    canonical_masechet = books.canonical_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for(
            "amud_range", masechet = canonical_masechet, start = start, end = end))
    return render_template(
        "talmud_page.html", title = "%s %s-%s" %(masechet, start, end))

# Creates a capturing lambda
def send_file_fn(name):
    return lambda ignored: send_file("static/%s" % name)

STATIC_FILES = (
    "main.css",
    "rendering.js",
    "snackbar.js",
    "talmud_page.js",
    "preferences_page.js",
)
for name in STATIC_FILES:
    extension = name[name.rindex(".") + 1:]
    app.add_url_rule(
        "/%s/<ignored>/%s" % (extension, name),
        name,
        send_file_fn(name))

# response = make_response(render_template('index.html', foo=42))
# response.headers['X-Parachutes'] = 'parachutes are cool'

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404_amud_not_found.html'), 404

# TODO: cache this
@app.route("/api/<masechet>/<amud>")
def amud_json(masechet, amud):
    sefaria_result = requests.get(
        "https://sefaria.org/api/texts/{masechet}.{amud}".format(masechet=masechet, amud=amud),
        # "context", "pad", and "multiple" are specified by Sefaria, but it's unclear what they do
        params = {
            "commentary": "1",
            # Even with wrapLinks=1, Jastrow (and perhaps more) is still wrapped. Instead, an active
            # filtering is performed just in case.
            "wrapLinks": "0",
        })
    if sefaria_result.status_code is not 200:
        return sefaria_result.text, 500
    try:
        sefaria_json = sefaria_result.json()
    except:
        return sefaria_result.text, 500

    result = {"id": amud}

    for i in ["title"]:
        result[i] = sefaria_json[i]

    hebrew = sefaria_json["he"]
    english = sefaria_json["text"]

    if len(hebrew) != len(english):
        return "Hebrew length != English length: %s" %(sefaria_result.text), 500

    result["sections"] = []
    for i in range(len(hebrew)):
        result["sections"].append({
            "he": hebrew[i],
            "en": sanitize_sefaria_links(english[i]),
            "commentary": {},
            })

    section_prefix = "%s %s:" %(sefaria_json["book"], amud)
    for comment in sefaria_json["commentary"]:
        if len(comment["he"]) is 0 and \
           len(comment["text"]) is 0:
            continue

        # TODO: question: if this spans multiple sections, is placing it in the first always correct?
        section = int(comment["anchorRefExpanded"][0][len(section_prefix):]) - 1

        if section >= len(result["sections"]):
            print("Unplaceable comment:", comment["sourceRef"], comment["anchorRefExpanded"])
            continue

        commentary_dict = result["sections"][section]["commentary"]
        matching_commentary_kind = _matching_commentary_kind(comment)
        if not matching_commentary_kind:
            continue

        if matching_commentary_kind["englishName"] not in commentary_dict:
            commentary_dict[matching_commentary_kind["englishName"]] = []

        comment_english = sanitize_sefaria_links(comment["text"])
        if comment["he"] == comment_english:
            # Fix an issue where sometimes Sefaria returns the exact same text. For now, safe to
            # assume that the equivalent text is Hebrew
            comment_english = ""

        commentary_dict[matching_commentary_kind["englishName"]].append({
            "he": comment["he"],
            "en": comment_english,
            "sourceRef": comment["sourceRef"],
            "sourceHeRef": comment["sourceHeRef"],
            })

    last_section = result["sections"][len(result["sections"]) - 1]
    if HADRAN_PATTERN.findall(last_section["he"]):
        last_section["he"] = BR_PREFIX.sub("<br>", last_section["he"])
        last_section["en"] = ""
        last_section["commentary"] = {}
        last_section["hadran"] = True

    return jsonify(result)

def has_matching_property(first, second, property_name):
    return property_name in first and \
        property_name in second and \
        first[property_name] == second[property_name]

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

def _matching_commentary_kind(comment):
    name = comment["collectiveTitle"]["en"]
    for kind in _COMMENTARIES:
        if name == kind["englishName"] or \
           has_matching_property(comment, kind, "category") or \
           has_matching_property(comment, kind, "type") or \
           "englishNamePattern" in kind and kind["englishNamePattern"].findall(name):
            return kind

@app.route("/old/<masechet>/<amud>/json")
def amud_json_old(masechet, amud):
    return jsonify(_amud_json(masechet, amud))

def _get_comments_at_label_indices(source, label_indices):
    result = []
    for i, comment in enumerate(source):
        if i + 1 in label_indices:
            result.append(comment)
    return result

@app.route("/preferences")
def preferences():
    return render_template("preferences.html")

if __name__ == '__main__':
    app.run(threaded=True, port=os.environ.get("PORT", 5000))
