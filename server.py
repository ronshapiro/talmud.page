#!/usr/bin/python
# -*- coding: utf-8 -*-

from books import Books
from flask import Flask
from flask import jsonify
from flask import redirect
from flask import render_template
from flask import request
from flask import url_for
from tanach import Tanach
import datetime
import json
import re
import uuid

app = Flask(__name__)
books = Books()
tanach = Tanach()

def _read_json_file(path):
    with open(path, "r") as f:
        return json.load(f)

BIBLICAL_INDEX = _read_json_file("sefaria-data/gemara-biblical-links.json")
COMMENTARY_INDEX = _read_json_file("sefaria-data/gemara-commentary-links.json")

MULTIPLE_SPACES = re.compile("  +")
AMUD_ALEPH_PERIOD = re.compile("(\d)\\.")
AMUD_BET_COLON = re.compile("(\d):")

@app.route("/")
def homepage():
    return render_template("homepage.html")

@app.route("/view_daf", methods = ["POST"])
def search_handler():
    term = request.form["search_term"].strip()
    term = MULTIPLE_SPACES.sub(" ", term)
    term = AMUD_ALEPH_PERIOD.sub("\\1a", term)
    term = AMUD_BET_COLON.sub("\\1b", term)
    words = term.split(" ")
    # TODO: this doesn't work since masechtot can be multiple words
    masechet = books.canonical_masechet_name(words[0])
    if masechet is None:
        # TODO: proper error page
        raise KeyError(masechet)
    # TODO: verify daf exists

    if words[1].count("-") is 1:
        start,end = words[1].split("-")
        return redirect(url_for("amud_range", masechet = masechet, start = start, end = end))
    elif len(words) is 4 and words[2] == "to":
        start = words[1]
        end = words[3]
        return redirect(url_for("amud_range", masechet = masechet, start = start, end = end))
    return redirect(url_for("amud", masechet = masechet, amud = words[1]))

# https://www.sefaria.org.il/download/version/Berakhot%20-%20he%20-%20William%20Davidson%20Edition%20-%20Vocalized%20Aramaic.json

@app.route("/<masechet>/<amud>")
def amud(masechet, amud):
    canonical_masechet = books.canonical_masechet_name(masechet)
    if canonical_masechet is None:
        pass # TODO: handle
    elif canonical_masechet != masechet:
        return redirect(url_for("amud", masechet = canonical_masechet, amud = amud))
    return render_template("talmud_page.html", title = "%s %s" %(masechet, amud))

@app.route("/<masechet>/<start>/to/<end>")
def amud_range(masechet, start, end):
    canonical_masechet = books.canonical_masechet_name(masechet)
    if canonical_masechet is None:
        pass # TODO: handle
    elif canonical_masechet != masechet:
        return redirect(url_for(
            "amud_range", masechet = canonical_masechet, start = start, end = end))
    return render_template("talmud_page.html", title = "%s %s-%s" %(masechet, start, end))

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404_amud_not_found.html'), 404

@app.route("/<masechet>/<amud>/json")
def amud_json(masechet, amud):
    return amud_range_json(masechet, amud, amud)

@app.route("/<masechet>/<start>/to/<end>/json")
def amud_range_json(masechet, start, end):
    results = []
    for amud in _amudim_in_range(start, end):
        results.append(_amud_json(masechet, amud))
    return jsonify(results)

def _amudim_in_range(start, end):
    start_number = int(start[:-1])
    end_number = int(end[:-1])
    if start == end or start_number > end_number:
        # TODO: return error?
        return [start]

    results = []
    next_amud = start
    while next_amud != end:
        results.append(next_amud)
        next_amud = _next_amud(next_amud)

    results.append(end)
    return results

def _next_amud(amud):
    number = amud[:-1]
    if amud[-1] == "a":
        return "%sb" % number
    return "%sa" % (int(number) + 1)

def _get_comments_at_label_indices(source, label_indices):
    result = []
    for i, comment in enumerate(source):
        if i + 1 in label_indices:
            result.append(comment)
    return result

def _amud_json(masechet, amud):
    gemara = books.gemara(masechet)[amud]
    english = books.gemara_english(masechet)[amud]
    rashi = books.rashi(masechet)[amud]
    tosafot = books.tosafot(masechet)[amud]
    rashba = books.rashba(masechet)[amud]
    ramban = books.ramban(masechet)[amud]

    sections = []
    for i in range(len(gemara)):
        label = "%s:%s" %(amud, i + 1)
        commentary_index = COMMENTARY_INDEX[masechet].get(label, {})
        biblical_index = BIBLICAL_INDEX[masechet].get(label, {})
        sections.append({
            "gemara": gemara[i],
            # English is missing when the Hadran is at the end of the Amud, e.g. Brachot 34b
            "english": english[i] if i < len(english) else [],
            "rashi": rashi[i] if i < len(rashi) else [],
            "tosafot": tosafot[i] if i < len(tosafot) else [],
            "rashba": _get_comments_at_label_indices(rashba, commentary_index.get("rashba", [])),
            "ramban": _get_comments_at_label_indices(ramban, commentary_index.get("ramban", [])),
            "quotedVerses": _get_verse_texts(biblical_index)
        })

    return dict(masechet=masechet,
                amud=amud,
                sections=sections)

def _get_verse_texts(verses):
    return [
        {"hebrew": tanach.hebrew(verse["book"])[verse["chapter"]][verse["verse"]],
         "english": tanach.english(verse["book"])[verse["chapter"]][verse["verse"]],
         "label": {
             "hebrew": "%s %s:%s" %(verse["book"], verse["chapter"] + 1, verse["verse"]),
             "english": "%s %s:%s" %(verse["book"], verse["chapter"] + 1, verse["verse"]),
         }
        }
        for verse in verses
    ]

if __name__ == '__main__':
    app.run(threaded=True, port=5000)
