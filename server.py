#!/usr/bin/python
# -*- coding: utf-8 -*-

from books import Books
from flask import Flask
from flask import jsonify
from flask import redirect
from flask import render_template
from flask import request
from flask import url_for
import datetime
import json
import re
import uuid

app = Flask(__name__)
books = Books()

MULTIPLE_SPACES = re.compile("  +")

@app.route("/")
def homepage():
    return render_template("homepage.html")

@app.route("/view_daf", methods = ["POST"])
def search_handler():
    term = request.form["search_term"].strip()
    term = MULTIPLE_SPACES.sub(" ", term)
    words = term.split(" ")
    masechet = books.canonical_masechet_name(words[0])
    if masechet is None:
        # TODO: proper error page
        raise KeyError(masechet)
    # TODO: verify daf exists
    return redirect(url_for("amud", masechet = masechet, amud = words[1]))

# https://www.sefaria.org.il/download/version/Berakhot%20-%20he%20-%20William%20Davidson%20Edition%20-%20Vocalized%20Aramaic.json

@app.route("/<masechet>/<amud>")
def amud(masechet, amud):
    canonical_masechet = books.canonical_masechet_name(masechet)
    if canonical_masechet is None:
        pass # TODO: handle
    elif canonical_masechet != masechet:
        return redirect(url_for("amud", masechet = canonical_masechet, amud = amud))
    return render_template("talmud_page.html", masechet=masechet, amud=amud)

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404_amud_not_found.html'), 404

@app.route("/<masechet>/<amud>/json")
def amud_json(masechet, amud):
    gemara = books.gemara(masechet)[amud]
    english = books.gemara_english(masechet)[amud]
    rashi = books.rashi(masechet)[amud]
    tosafot = books.tosafot(masechet)[amud]

    sections = []
    for i in range(len(gemara)):
        sections.append({
            "gemara": gemara[i],
            "rashi": rashi[i] if i < len(rashi) else [],
            "tosafot": tosafot[i] if i < len(tosafot) else [],
            "english": english[i],
        })
        
    return jsonify(sections) 


if __name__ == '__main__':
    app.run(threaded=True, port=5000)
