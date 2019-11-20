#!/usr/bin/python
# -*- coding: utf-8 -*-

from flask import Flask
from flask import jsonify
from flask import redirect
from flask import request
from flask import render_template
from flask import url_for
from mongo_impl import init_mongo_collection
from result_types import SearchResult
from result_types import UiResult
from searcher import Searcher
import datetime
import json
import uuid

app = Flask(__name__)

searcher = Searcher()

mongo_collection = init_mongo_collection()

def _json_error(message):
    return jsonify({"result": "error", "message": message}), 404

def _json_success():
    return jsonify({"result": "success"})

def create_uuid():
    return str(uuid.uuid4())

@app.route("/")
def homepage():
    return render_template("homepage.html")

@app.route('/search/new', methods=["POST"])
def create_search():
    term = request.form["search_term"]
    ui_results = [ui_result.to_dict()
                  for ui_result in searcher.bolded_search_results(term)]
    search_id = create_uuid()
    mongo_collection.insert_one({"search_id": search_id,
                                 "search_term": term,
                                 "ui_results": ui_results,
                                 "created_at_utc": datetime.datetime.utcnow()})
    return redirect(url_for("show_search", search_id=search_id))

def _find_search(search_id):
    return mongo_collection.find_one({"search_id": search_id})

def _js_boolean(boolean):
    if boolean:
        return "true"
    else:
        return "false"

@app.route('/search/<search_id>')
def show_search(search_id):
    search_result = _find_search(search_id)
    if not search_result:
        return render_template("404_search_not_found.html"), 404
    return render_template("search_results.html",
                           search_term = search_result["search_term"],
                           results = json.dumps(search_result["ui_results"]),
                           frozen = _js_boolean(search_result.get("frozen", False)))

@app.route("/hide_result/<search_id>/<result_id>")
def hide_result(search_id, result_id):
    search_result = _find_search(search_id);
    if not search_result:
        return _json_error("result not found")
    if search_result.get("frozen", False):
        return _json_error("already frozen")
    mongo_collection.update_one({"search_id": search_id},
                                {"$set": {"ui_results.%s.visible" %(result_id): False}})
    return _json_success()

@app.route('/search/freeze/<search_id>')
def freeze_search(search_id):
    search_result = _find_search(search_id)
    if not search_result:
        return _json_error("result not found")
    mongo_collection.update_one({"search_id": search_id},
                                {"$set": {"frozen": True}})
    return _json_success()

@app.route('/search/copy/<search_id>')
def copy_search(search_id):
    search_result = _find_search(search_id)
    if not search_result:
        return render_template("404_search_not_found.html"), 404

    search_result["created_at_utc"] = datetime.datetime.utcnow()
    search_result["copied_from"] = {"_id": search_result["_id"],
                                    "search_id": search_result["search_id"]}
    new_uuid = create_uuid()
    search_result["search_id"] = new_uuid
    search_result.pop("frozen", None)
    search_result.pop("_id")

    mongo_collection.insert_one(search_result)

    return redirect(url_for("show_search", search_id=new_uuid))

if __name__ == '__main__':
    app.run(threaded=True, port=5000)
