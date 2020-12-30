import argparse
import json
from books import BOOKS
import sys

def file_contents():
    json_dict = {}
    for book in BOOKS.all_books:
        json_dict[book.canonical_name] = dict(
            start = book.start,
            end = book.end,
            isMasechet = book.is_masechet())
    as_json = json.dumps(json_dict, indent = 2, sort_keys = True, ensure_ascii = False)
    return f"""interface Book {{
  start: string;
  end: string;
  isMasechet: boolean;
}}

export const books: Record<string, Book> = {as_json};
"""

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--setup", action="store_const", const=True)
args = parser.parse_args()

path = "js/books.ts"

if args.setup:
    with open(path, "w") as f:
        f.write(file_contents())
else:
    with open(path, "r") as f:
        desired = file_contents()
        if f.read() != file_contents():
            print("Contents not equal! Rerun with --setup")
            sys.exit(1)
