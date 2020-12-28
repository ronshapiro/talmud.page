#!/usr/bin/python
# -*- coding: utf-8 -*-

from amud_doesnt_exist import AmudDoesntExistException
from api_request_handler import ApiException
from api_request_handler import RealRequestMaker
from api_request_handler import TalmudApiRequestHandler
from api_request_handler import TanakhApiRequestHandler
from flask import Flask
from flask import has_request_context
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
from masechtot import next_amud
from masechtot import previous_amud
from util.json_files import write_json
import cachetools
import flask.logging
import logging
import math
import os
import queue
import random
import string
import sys
import threading
import traceback
import uuid

def print(*args):
    raise AssertionError(f"Use app.logger instead of print(). Called with: {' '.join(args)}")

random_hash = ''.join(random.choice(string.ascii_letters) for i in range(7))
app = Flask(__name__)
masechtot = Masechtot()
request_maker = RealRequestMaker()
api_request_handler = TalmudApiRequestHandler(request_maker, print_function=app.logger.info)
tanakh_api_request_handler = TanakhApiRequestHandler(request_maker, print_function=app.logger.info)

class RequestFormatter(logging.Formatter):
    width = 1

    def format(self, record):
        header = f"{record.levelname}({record.module}.py)"
        self.width = max(self.width, len(header))
        header = header.ljust(self.width)
        if has_request_context():
            if app.debug:
                path = request.full_path
                if path.endswith("?"):
                    path = path[:-1]
            else:
                path = request.url
            if not app.debug:
                path += f" by {request.remote_addr}"
            header = f"{header} | {path}"
        record.header = header

        return super().format(record)

flask.logging.default_handler.setFormatter(RequestFormatter(
    "%(header)s | %(message)s"
))

@app.before_request
def strip_www():
    if request.url.startswith("https://www."):
        return redirect(request.url.replace("https://www.", "https://"))

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

def are_amudim_in_reverse_order(start, end):
    start_number = int(start[:-1])
    end_number = int(end[:-1])

    return (
        start_number > end_number
        or (start_number == end_number and start[-1] == "b" and end[-1] == "a"))

def redirect_for_full_daf(masechet, start, end):
    original_start = start
    original_end = end

    if start.isdigit():
        start = f"{start}a"
    if end.isdigit():
        end = f"{end}b"
    if (not masechtot.does_amud_exist(masechet, end) and (
            masechtot.does_amud_exist(masechet, previous_amud(end)))):
        end = previous_amud(end)
    if (not masechtot.does_amud_exist(masechet, start) and (
            masechtot.does_amud_exist(masechet, next_amud(start)))):
        start = next_amud(start)

    if are_amudim_in_reverse_order(start, end):
        return redirect_for_full_daf(masechet, original_end, original_start)

    return redirect(url_for("amud_range", masechet = masechet, start = start, end = end))

@app.route("/<masechet>/<amud>")
def amud(masechet, amud):
    canonical_masechet = masechtot.canonical_url_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for("amud", masechet = canonical_masechet, amud = amud))
    if amud.isdigit():
        return redirect_for_full_daf(masechet, amud, amud)
    _validate_amudim(masechet, amud)
    return render_compiled_template("talmud_page.html", title = f"{masechet} {amud}")

@app.route("/<masechet>/<start>/to/<end>")
def amud_range(masechet, start, end):
    if start == end:
        return redirect(url_for("amud", masechet = masechet, amud = start))

    canonical_masechet = masechtot.canonical_url_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for(
            "amud_range", masechet = canonical_masechet, start = start, end = end))
    if start.isdigit() or end.isdigit():
        return redirect_for_full_daf(masechet, start, end)
    _validate_amudim(masechet, start, end)

    if are_amudim_in_reverse_order(start, end):
        return redirect(url_for(
            "amud_range", masechet = canonical_masechet, start = end, end = start))

    return render_compiled_template("talmud_page.html", title = f"{masechet} {start} - {end}")

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


for name in os.listdir("fonts"):
    app.add_url_rule("/font/%s" % name, name, send_file_fn("fonts/%s" % name))

@app.errorhandler(AmudDoesntExistException)
def amud_doesnt_exist_404(e):
    return render_template("error_page.html", message=e.message(), title="Error"), 404

@app.errorhandler(InvalidQueryException)
def invalid_query_404(e):
    return render_template("error_page.html", message=e.message, title="Invalid Query"), 404

@app.errorhandler(UnknownMasechetNameException)
def unknown_masechet_404(e):
    message = f'Could not find masechet "{e.name}"'
    return render_template("error_page.html", message=message, title="Invalid Query"), 404

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

amudim_to_cache_queue = queue.Queue()

def cache_amud_response_in_background():
    while True:
        masechet, amud = amudim_to_cache_queue.get()
        get_and_cache_amud_json(masechet, amud, verb="Precaching")
        amudim_to_cache_queue.task_done()
        app.logger.info(f"Queue size: {amudim_to_cache_queue.qsize()}")

threading.Thread(target=cache_amud_response_in_background, daemon=True).start()

def get_and_cache_amud_json(masechet, amud, verb="Requesting"):
    cache_key = (masechet, amud)
    response = amud_cache.get(cache_key)
    if not response:
        try:
            app.logger.info(f"{verb} {masechet} {amud}")
            response = api_request_handler.handle_request(masechet, amud)
            app.logger.info(f"{verb} {masechet} {amud} --- Done")
        except ApiException as e:
            return {"error": e.message, "code": e.internal_code}, e.http_status
        except Exception:
            _uuid = str(uuid.uuid4())
            app.logger.error(f"Error with uuid: {_uuid}")
            traceback.print_exc()
            return {"error": "An unknown exception occurred", "id": _uuid}, 500
    # no matter what, always update the LRU status
    amud_cache[cache_key] = response
    return response, 200

@app.route("/api/<masechet>/<amud>")
def amud_json(masechet, amud):
    canonical_masechet = masechtot.canonical_url_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for("amud_json", masechet = canonical_masechet, amud = amud))
    try:
        _validate_amudim(masechet, amud)
    except AmudDoesntExistException as e:
        return jsonify({"error": e.message()}), 404

    response, code = get_and_cache_amud_json(masechet, amud)

    for possible_amud in [previous_amud(amud), next_amud(amud)]:
        if masechtot.does_amud_exist(masechet, possible_amud):
            amudim_to_cache_queue.put((masechet, possible_amud))
        else:
            app.logger.error(f"Ignoring {possible_amud}")

    return jsonify(response), code

@app.route("/api/tanakh/<book>/<int:chapter>")
def tanach_json(book, chapter):
    return jsonify(tanakh_api_request_handler.handle_request(book, chapter))

@app.route("/preferences")
def preferences():
    return render_compiled_template("preferences.html")

for name in os.listdir("favicon"):
    app.add_url_rule("/%s" % name, name, send_file_fn("favicon/%s" % name))

@app.route("/manifest.json")
def manifest_json():
    return send_file("static/progressive_webapp_manifest.json")

@app.route("/caveats/google-docs")
def google_docs_caveats():
    return redirect("https://github.com/ronshapiro/talmud.page/blob/base/GoogleDriveCaveats.md")

@app.route("/notes")
def all_notes():
    return redirect("https://drive.google.com/drive/search?q=talmud.page notes")

@app.route("/<masechet>/notes")
def notes(masechet):
    canonical_masechet = masechtot.canonical_url_masechet_name(masechet)
    if canonical_masechet != masechet:
        return redirect(url_for("notes", masechet = canonical_masechet))

    return render_compiled_template("notes_redirecter.html", masechet=masechet)

@app.route("/yomi")
@app.route("/daf-yomi")
def yomi():
    return render_compiled_template("daf_yomi_redirector.html")

if app.debug:
    @app.route("/google-docs-record", methods=["POST"])
    def google_docs_output():
        data_dump = request.get_json()
        data_dump["revisionId"] = "revisionId"
        del data_dump["documentStyle"]
        del data_dump["namedStyles"]
        del data_dump["suggestionsViewMode"]
        write_json("js/google_drive/__tests__/do_not_submit_rename_me.json", data_dump)
        return ""

if __name__ == '__main__':
    app.run(threaded=True, port=os.environ.get("PORT", 5000))
