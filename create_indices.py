#!/usr/bin/python
# -*- coding: utf-8 -*-

from mongo_impl import init_mongo_collection

mongo_collection = init_mongo_collection()

mongo_collection.create_index("search_id",
                              name="search_id",
                              unique=True,
                              background=True,
                              sparse=True)
