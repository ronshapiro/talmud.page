#!/usr/bin/python
# -*- coding: utf-8 -*-

from amud_doesnt_exist import AmudDoesntExistException
from api_request_handler import ApiRequestHandler
from api_request_handler import ApiException
from api_request_handler import RealRequestMaker
from flask import Flask
from flask import jsonify
from flask import redirect
from flask import render_template
from flask import render_template_string
from flask import request
from flask import send_file
from flask import url_for
from masechtot import InvalidQueryException
from masechtot import Masechtot
from masechtot import UnknownMasechetNameException
import cachetools
import datetime
import math
import os
import random
import string
import sys
import traceback
import uuid

random_hash = ''.join(random.choice(string.ascii_letters) for i in range(7))
app = Flask(__name__)
masechtot = Masechtot()
api_request_handler = ApiRequestHandler(RealRequestMaker())

@app.context_processor
def template_constants():
    return dict(
        random_hash=random_hash,
        debug=app.debug,
    )

def render_compiled_template(file_name, **extra_template_variables):
    with app.open_resource("dist/%s" % file_name, "r") as template_file:
        return render_template_string(
            template_file.read(),
            **extra_template_variables)

@app.route("/")
def homepage():
    return render_compiled_template("homepage.html")

@app.route("/view_daf", methods = ["POST"])
def search_handler():
    query = request.form["search_term"]
    parsed = masechtot.parse(query)
    if parsed.end:
        return redirect(url_for("amud_range",
                                masechet = parsed.masechet,
                                start = parsed.start,
                                end = parsed.end))
    return redirect(url_for("amud",
                            masechet = parsed.masechet,
                            amud = parsed.start))

def _validate_amudim(masechet, *amudim):
    non_existent_amudim = list(filter(lambda x: not masechtot.does_amud_exist(masechet, x), amudim))
    if non_existent_amudim:
        raise AmudDoesntExistException(masechet, non_existent_amudim)

@app.route("/<masechet>/<amud>")
def amud(masechet, amud):
    canonical_masechet = masechtot.canonical_url_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for("amud", masechet = canonical_masechet, amud = amud))
    _validate_amudim(masechet, amud)
    return render_compiled_template("talmud_page.html", title = "%s %s" %(masechet, amud))

@app.route("/<masechet>/<start>/to/<end>")
def amud_range(masechet, start, end):
    canonical_masechet = masechtot.canonical_url_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for(
            "amud_range", masechet = canonical_masechet, start = start, end = end))
    _validate_amudim(masechet, start, end)
    return render_compiled_template(
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

serve_static_files("css")

for name in os.listdir("dist"):
    if name.endswith(".js") or name.endswith(".css") or (app.debug and name.endswith(".map")):
        app.add_url_rule("/%s" % name, name, send_file_fn("dist/%s" % name))

@app.errorhandler(AmudDoesntExistException)
def amud_doesnt_exist_404(e):
    return render_template("error_page.html", message=e.message(), title="Error"), 404

@app.errorhandler(InvalidQueryException)
def amud_doesnt_exist_404(e):
    return render_template("error_page.html", message=e.message, title="Invalid Query"), 404

@app.errorhandler(404)
def page_not_found(e):
    return render_template("error_page.html",
                           message="We don't know what happened!",
                           title="Unknown Error")

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
    canonical_masechet = masechtot.canonical_url_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for("amud_json", masechet = canonical_masechet, amud = amud))
    try:
        _validate_amudim(masechet, amud)
    except AmudDoesntExistException as e:
        return jsonify({"error": e.message()}), 404

    cache_key = (masechet, amud)
    response = amud_cache.get(cache_key)
    if not response:
        print(f"Requesting {masechet} {amud}")
        try:
            response = api_request_handler.amud_api_request(masechet, amud)
        except ApiException as e:
            return jsonify({"error": e.message, "code": e.internal_code}), e.http_status
        except:
            _uuid = str(uuid.uuid4())
            print(f"Error with uuid: {_uuid}")
            traceback.print_exc()
            return jsonify({"error": "An unknown exception occurred", "id": _uuid})
    # no matter what, always update the LRU status
    amud_cache[cache_key] = response
    return jsonify(response)

@app.route("/preferences")
def preferences():
    return render_compiled_template("preferences.html")

for name in os.listdir("favicon"):
    app.add_url_rule("/%s" % name, name, send_file_fn("favicon/%s" % name))

@app.route("/manifest.json")
def manifest_json():
    return send_file("static/progressive_webapp_manifest.json")

if __name__ == '__main__':
    app.run(threaded=True, port=os.environ.get("PORT", 5000))
