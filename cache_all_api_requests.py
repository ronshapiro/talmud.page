import argparse
import api_request_handler
import os
import traceback
from api_request_handler import ApiException
from books import BOOKS
from books import next_amud
from util.json_files import write_json

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--overwrite", action="store_const", const=True)
args = parser.parse_args()

request_handler = api_request_handler.CompoundRequestHandler(
    api_request_handler.RealRequestMaker(),
    print_function = lambda *args: None)

for book in BOOKS:
    section = book.start
    while True:
        file_path = f"cached_outputs/api_request_handler/{book.canonical_name}.{section}.json"
        if args.overwrite or not os.path.exists(file_path):
            try:
                write_json(file_path,
                           request_handler.handle_request(book.canonical_name, section))
            except ApiException as e:
                print(f"ApiException in {book.canonical_name} {section}: {e.message}")
                if e.internal_code == ApiException.SEFARIA_HTTP_ERROR:
                    continue
            except Exception:
                print(f"Exception in {book.canonical_name} {section}")
                traceback.print_exc()
                continue
        if section == book.end:
            break

        if book.is_masechet():
            section = next_amud(section)
        else:
            section = str(int(section) + 1)
    print(f"Finished {book.canonical_name}")
print("Finished!")
