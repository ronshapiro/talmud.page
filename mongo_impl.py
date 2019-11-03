import os
from pymongo import MongoClient

def init_mongo_collection():
    mongodb_uri = os.environ.get("MONGODB_URI", None)
    if not mongodb_uri:
        raise EnvironmentError("MONGODB_URI environment variable is not set")

    db_name = mongodb_uri[mongodb_uri.rindex("/") + 1:]
    db = MongoClient(mongodb_uri, retryWrites=False)[db_name]

    collection_name = os.environ.get("MONGODB_COLLECTION", "local_testing")

    return db[collection_name]
