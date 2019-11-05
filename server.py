#!/usr/bin/python
# -*- coding: utf-8 -*-

import datetime
from flask import Flask, redirect, render_template, url_for
import json
from mongo_impl import init_mongo_collection
from result_types import SearchResult, UiResult
from searcher import Searcher
import uuid

app = Flask(__name__)

searcher = Searcher()

mongo_collection = init_mongo_collection()

@app.route('/create_search/<term>')
def create_search(term):
    ui_results = [ui_result.to_dict()
                  for ui_result in searcher.bolded_search_results(term)]
    search_id = str(uuid.uuid4())
    mongo_collection.insert_one({"search_id": search_id,
                                 "search_term": term,
                                 "ui_results": ui_results,
                                 "created_at_utc": datetime.datetime.utcnow()})
    return redirect(url_for("show_search", search_id=search_id))

@app.route('/search/<search_id>')
def show_search(search_id):
    search_result = mongo_collection.find_one({"search_id": search_id})
    if not search_result:
        return render_template("404_search_not_found.html"), 404
    return render_template("search_results.html",
                           search_term = search_result["search_term"],
                           results = json.dumps(search_result["ui_results"]))

@app.route("/hide_result/<search_id>/<result_id>")
def hide_result(search_id, result_id):
    mongo_collection.update_one({"search_id": search_id},
                                {"$set": {"ui_results.%s.visible" %(result_id): False}})
    return "Editted"

if __name__ == '__main__':
    app.run(threaded=True, port=5000)
