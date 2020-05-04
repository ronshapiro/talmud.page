import argparse
import json
import masechtot

def file_contents():
    json_dict = {}
    for m in masechtot.MASECHTOT:
        json_dict[m.canonical_name] = dict(start = m.start, end = m.end)
    as_json = json.dumps(json_dict, indent = 2, sort_keys = True)
    return f"const MASECHTOT = {as_json};\n"

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--setup", action="store_const", const=True)
args = parser.parse_args()

path = "js/masechtot.js"

if args.setup:
    with open(path, "w") as f:
        f.write(file_contents());
else:
    with open(path, "r") as f:
        desired = file_contents()
        if f.read() != file_contents():
            print("Contents not equal! Rerun with --setup")
