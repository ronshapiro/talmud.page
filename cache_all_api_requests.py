import api_request_handler
import json
import os
import traceback
from masechtot import MASECHTOT
from masechtot import next_amud

def write_json(file_name, data):
    with open(file_name, "w") as output_file:
        json.dump(data,
                  output_file,
                  ensure_ascii = False,
                  sort_keys = True)
        output_file.write("\n")

request_handler = api_request_handler.ApiRequestHandler(
    api_request_handler.RealRequestMaker(),
    print_function = lambda *args: None)
for masechet in MASECHTOT:
    amud = masechet.start
    while True:
        file_path = f"cached_outputs/api_request_handler/{masechet.canonical_name}.{amud}.json"
        if not os.path.exists(file_path):
            try:
                write_json(file_path,
                           request_handler.amud_api_request(masechet.canonical_name, amud))
            except api_request_handler.ApiException as e:
                print(f"ApiException in {masechet.canonical_name} {amud}: %s" %(e.message))
                if e.internal_code == ApiException.SEFARIA_HTTP_ERROR:
                    continue
            except Exception as e:
                print(f"Exception in {masechet.canonical_name} {amud}")
                traceback.print_exc()
                continue
        if amud == masechet.end:
            break
        amud = next_amud(amud)
    print(f"Finished {masechet.canonical_name}")
print("Finished!")
