#!/usr/bin/python
# -*- coding: utf-8 -*-

from api_request_handler import ApiRequestHandler
from api_request_handler import RealRequestMaker
from flask import Flask
from flask import jsonify
from flask import redirect
from flask import render_template as flask_render_template
from flask import request
from flask import send_file
from flask import url_for
from masechtot import Masechtot
import cachetools
import datetime
import math
import os
import random
import string
import sys

random_hash = ''.join(random.choice(string.ascii_letters) for i in range(7))
app = Flask(__name__)
masechtot = Masechtot()
api_request_handler = ApiRequestHandler(RealRequestMaker())

def render_template(template_name, **extra_template_variables):
    return flask_render_template(
        template_name,
        random_hash=random_hash,
        debug=app.debug,
        **extra_template_variables)

@app.route("/")
def homepage():
    return render_template("homepage.html")

@app.route("/view_daf", methods = ["POST"])
def search_handler():
    query = request.form["search_term"]
    parsed = masechtot.parse(query)
    if parsed.end:
        return redirect(url_for("amud_range",
                                masechet = parsed.masechet,
                                start = parsed.start,
                                end = parsed.end))
    else:
        return redirect(url_for("amud",
                                masechet = parsed.masechet,
                                amud = parsed.start))

    # TODO: proper error page
    # TODO: verify daf exists
    raise ValueError(query)

@app.route("/<masechet>/<amud>")
def amud(masechet, amud):
    canonical_masechet = masechtot.canonical_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for("amud", masechet = canonical_masechet, amud = amud))
    return render_template(
        "talmud_page.html", title = "%s %s" %(masechet, amud))

@app.route("/<masechet>/<start>/to/<end>")
def amud_range(masechet, start, end):
    canonical_masechet = masechtot.canonical_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for(
            "amud_range", masechet = canonical_masechet, start = start, end = end))
    return render_template(
        "talmud_page.html", title = "%s %s-%s" %(masechet, start, end))

# Creates a capturing lambda
def send_file_fn(name):
    return lambda: send_file(name)

# Creates a capturing lambda
def send_file_fn_with_ignored_pattern(name):
    return lambda ignored: send_file(name)

def serve_static_files(directory):
    for name in os.listdir(directory):
        app.add_url_rule(
            "/%s/<ignored>/%s" % (directory, name),
            name,
            send_file_fn_with_ignored_pattern("%s/%s" % (directory, name)))

serve_static_files("js")
serve_static_files("css")
# response = make_response(render_template('index.html', foo=42))
# response.headers['X-Parachutes'] = 'parachutes are cool'

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404_amud_not_found.html'), 404

# This does not factor in cached strings, but that should not make much of a difference
def json_size_in_memory(json_object):
    if type(json_object) in (list, tuple):
        return sys.getsizeof(json_object) + \
            sum(map(json_size_in_memory, json_object))
    elif type(json_object) is dict:
        return sys.getsizeof(json_object) + \
            sum(map(json_size_in_memory, json_object.keys())) + \
            sum(map(json_size_in_memory, json_object.values()))
    return sys.getsizeof(json_object)

def next_smallest_power_of_2(ideal_value):
    return 2 ** math.floor(math.log(ideal_value, 2))

amud_cache = cachetools.LRUCache(
    # cachetools documentation states that maxsize performs best if it is a power of 2
    maxsize = next_smallest_power_of_2(
        # 150MB, which gets translated into something closer to 134mb by next_smallest_power_of_2
        150 * 1e6),
    getsizeof = json_size_in_memory)

@app.route("/api/<masechet>/<amud>")
def amud_json(masechet, amud):
    cache_key = (masechet, amud)
    response = amud_cache.get(cache_key)
    if not response:
        print(f"Requesting {masechet} {amud}")
        response = api_request_handler.amud_api_request(masechet, amud)
    # no matter what, always update the LRU status
    amud_cache[cache_key] = response
    return jsonify(response)

@app.route("/preferences")
def preferences():
    return render_template("preferences.html")

FAVICON_FILES = (
    "apple-icon-57x57.png",
    "apple-icon-60x60.png",
    "apple-icon-72x72.png",
    "apple-icon-76x76.png",
    "apple-icon-114x114.png",
    "apple-icon-120x120.png",
    "apple-icon-144x144.png",
    "apple-icon-152x152.png",
    "apple-icon-180x180.png",
    "android-icon-192x192.png",
    "favicon.ico",
    "favicon-32x32.png",
    "favicon-96x96.png",
    "favicon-16x16.png",
    "ms-icon-144x144.png",
)
for name in FAVICON_FILES:
    app.add_url_rule("/%s" % name, name, send_file_fn("favicon/%s" % name))

@app.route("/manifest.json")
def manifest_json():
    return send_file("static/progressive_webapp_manifest.json")

if __name__ == '__main__':
    app.run(threaded=True, port=os.environ.get("PORT", 5000))
