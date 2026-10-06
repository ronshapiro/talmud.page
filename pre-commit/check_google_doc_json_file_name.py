#!/usr/bin/env python3

import sys

FILE_NAME = "js/google_drive/__tests__/do_not_submit_rename_me.json"

files = []
args = sys.argv[1:]
if "--files-from" in args:
    idx = args.index("--files-from")
    if idx + 1 < len(args):
        with open(args[idx + 1], "r", encoding="utf-8") as f:
            files.extend(line.strip() for line in f if line.strip())
else:
    files = args

if FILE_NAME in files:
    print(f"Rename {FILE_NAME} before submitting")
    exit(1)
