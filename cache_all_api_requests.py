import argparse
import api_request_handler
import os
import traceback
from api_request_handler import ApiException
from masechtot import MASECHTOT
from masechtot import next_amud
from util.json_files import write_json

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--overwrite", action="store_const", const=True)
args = parser.parse_args()

request_handler = api_request_handler.ApiRequestHandler(
    api_request_handler.RealRequestMaker(),
    print_function = lambda *args: None)
for masechet in MASECHTOT:
    amud = masechet.start
    while True:
        file_path = f"cached_outputs/api_request_handler/{masechet.canonical_name}.{amud}.json"
        if args.overwrite or not os.path.exists(file_path):
            try:
                write_json(file_path,
                           request_handler.handle_request(masechet.canonical_name, amud))
            except ApiException as e:
                print(f"ApiException in {masechet.canonical_name} {amud}: {e.message}")
                if e.internal_code == ApiException.SEFARIA_HTTP_ERROR:
                    continue
            except Exception:
                print(f"Exception in {masechet.canonical_name} {amud}")
                traceback.print_exc()
                continue
        if amud == masechet.end:
            break
        amud = next_amud(amud)
    print(f"Finished {masechet.canonical_name}")
print("Finished!")
