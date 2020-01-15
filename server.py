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
import uuid

app = Flask(__name__)
books = Books()

@app.route("/")
def homepage():
    return render_template("homepage.html")

# https://www.sefaria.org.il/download/version/Berakhot%20-%20he%20-%20William%20Davidson%20Edition%20-%20Vocalized%20Aramaic.json

@app.route("/<masechet>/<amud>")
def amud(masechet, amud):
    return render_template("talmud_page.html")

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
