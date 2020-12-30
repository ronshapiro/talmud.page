import argparse
import json
from commentaries import COMMENTARIES
import sys

def file_contents():
    json_list = []
    for commentary in COMMENTARIES:
        output = {}
        for k, v in commentary.items():
            if k not in ["englishNamePattern", "category"]:
                output[k] = v
        json_list.append(output)
    as_json = json.dumps(json_list, indent = 2, sort_keys = True, ensure_ascii = False)
    return f"""export interface CommentaryType {{
  englishName: string;
  hebrewName: string;
  className: string;
  showTitle?: boolean;
  cssCategory?: string;
  type?: string;
}}

export const MASTER_COMMENTARY_TYPES: CommentaryType[] = {as_json};
"""

parser = argparse.ArgumentParser(description='Test')
parser.add_argument("--setup", action="store_const", const=True)
args = parser.parse_args()

path = "js/commentaries.ts"

if args.setup:
    with open(path, "w") as f:
        f.write(file_contents())
else:
    with open(path, "r") as f:
        desired = file_contents()
        if f.read() != file_contents():
            print("Contents not equal! Rerun with --setup")
            sys.exit(1)
