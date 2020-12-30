#!/usr/bin/python
# -*- coding: utf-8 -*-

from amud_doesnt_exist import SectionDoesntExistException
from api_request_handler import ApiException
from api_request_handler import CompoundRequestHandler
from api_request_handler import RealRequestMaker
from books import BOOKS
from books import InvalidQueryException
from books import next_amud
from books import previous_amud
from books import UnknownBookNameException
from flask import Flask
from flask import has_request_context
from flask import jsonify
from flask import redirect
from flask import render_template
from flask import render_template_string
from flask import request
from flask import send_file
from flask import url_for
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
request_maker = RealRequestMaker()
api_request_handler = CompoundRequestHandler(request_maker, print_function=app.logger.info)

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
    parsed = BOOKS.parse(query)
    if parsed.end:
        return redirect(url_for("section_range",
                                title = parsed.book_name,
                                start = parsed.start,
                                end = parsed.end))
    return redirect(url_for("section",
                            title = parsed.book_name,
                            section = parsed.start))

def _validate_sections(book, *sections):
    non_existent_sections = list(filter(lambda x: not book.does_section_exist(x), sections))
    if non_existent_sections:
        raise SectionDoesntExistException(book.canonical_name, non_existent_sections)

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
    if (not BOOKS.does_section_exist(masechet, end) and (
            BOOKS.does_section_exist(masechet, previous_amud(end)))):
        end = previous_amud(end)
    if (not BOOKS.does_section_exist(masechet, start) and (
            BOOKS.does_section_exist(masechet, next_amud(start)))):
        start = next_amud(start)

    if are_amudim_in_reverse_order(start, end):
        return redirect_for_full_daf(masechet, original_end, original_start)

    return redirect(url_for("section_range", title = masechet, start = start, end = end))

def template(book):
    if book.is_masechet():
        return "talmud_page.html"
    return "tanakh.html"

@app.route("/<title>/<section>")
def section(title, section):
    canonical_name = BOOKS.canonical_url_name(title)
    if canonical_name != title:
        return redirect(url_for("section", title = canonical_name, section = section))
    book = BOOKS.by_canonical_name[canonical_name]
    if book.is_masechet() and section.isdigit():
        return redirect_for_full_daf(title, section, section)
    _validate_sections(book, section)
    return render_compiled_template(template(book), title = f"{title} {section}")

@app.route("/<title>/<start>/to/<end>")
def section_range(title, start, end):
    if start == end:
        return redirect(url_for("section", title = title, section = start))

    canonical_name = BOOKS.canonical_url_name(title)
    if canonical_name != title:
        return redirect(url_for(
            "section_range", title = canonical_name, start = start, end = end))
    book = BOOKS.by_canonical_name[canonical_name]
    if book.is_masechet() and (start.isdigit() or end.isdigit()):
        return redirect_for_full_daf(title, start, end)
    _validate_sections(book, start, end)

    if (book.is_masechet() and are_amudim_in_reverse_order(start, end)) or \
       (not book.is_masechet() and int(start) > int(end)):
        return redirect(url_for(
            "section_range", title = canonical_name, start = end, end = start))

    return render_compiled_template(template(book), title = f"{title} {start} - {end}")

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

@app.errorhandler(SectionDoesntExistException)
def section_doesnt_exist_404(e):
    return render_template("error_page.html", message=e.message(), title="Error"), 404

@app.errorhandler(InvalidQueryException)
def invalid_query_404(e):
    return render_template("error_page.html", message=e.message, title="Invalid Query"), 404

@app.errorhandler(UnknownBookNameException)
def unknown_book_404(e):
    message = f'Could not find title "{e.name}"'
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

section_cache = cachetools.LRUCache(
    # cachetools documentation states that maxsize performs best if it is a power of 2
    maxsize = next_smallest_power_of_2(
        # 150MB, which gets translated into something closer to 134mb by next_smallest_power_of_2
        150 * 1e6),
    getsizeof = json_size_in_memory)

sections_to_cache_queue = queue.Queue()

def cache_section_response_in_background():
    while True:
        title, section = sections_to_cache_queue.get()
        get_and_cache_section_json(title, section, verb="Precaching")
        sections_to_cache_queue.task_done()
        app.logger.info(f"Queue size: {sections_to_cache_queue.qsize()}")

threading.Thread(target=cache_section_response_in_background, daemon=True).start()

def get_and_cache_section_json(title, section, verb="Requesting"):
    cache_key = (title, section)
    response = section_cache.get(cache_key)
    if not response:
        try:
            app.logger.info(f"{verb} {title} {section}")
            response = api_request_handler.handle_request(title, section)
            app.logger.info(f"{verb} {title} {section} --- Done")
        except ApiException as e:
            return {"error": e.message, "code": e.internal_code}, e.http_status
        except Exception:
            _uuid = str(uuid.uuid4())
            app.logger.error(f"Error with uuid: {_uuid}")
            traceback.print_exc()
            return {"error": "An unknown exception occurred", "id": _uuid}, 500
    # no matter what, always update the LRU status
    section_cache[cache_key] = response
    return response, 200

@app.route("/api/<title>/<section>")
def section_json(title, section):
    canonical_name = BOOKS.canonical_url_name(title)
    if canonical_name != title:
        return redirect(url_for("section_json", title = canonical_name, section = section))
    book = BOOKS.by_canonical_name[canonical_name]
    try:
        _validate_sections(book, section)
    except SectionDoesntExistException as e:
        return jsonify({"error": e.message()}), 404

    response, code = get_and_cache_section_json(title, section)

    if book.is_masechet():
        possible_sections = [previous_amud(section), next_amud(section)]
    else:
        possible_sections = [str(int(section) - 1), str(int(section) + 1)]
    for possible_section in possible_sections:
        if BOOKS.does_section_exist(title, possible_section):
            sections_to_cache_queue.put((title, possible_section))
        else:
            app.logger.error(f"Ignoring {possible_section}")

    return jsonify(response), code

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

@app.route("/<title>/notes")
def notes(title):
    canonical_name = BOOKS.canonical_url_name(title)
    if canonical_name != title:
        return redirect(url_for("notes", title = canonical_name))

    return render_compiled_template("notes_redirecter.html", title=title)

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
