#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys

VIOLATION_REGEX = re.compile("[ -]+".join(["do", "not", "submit"]), re.I)
EXEMPTIONS = {".pre-commit-config.yaml", "pre-commit/check_do_not_submit.py"}

files = []
args = sys.argv[1:]
if "--files-from" in args:
    idx = args.index("--files-from")
    if idx + 1 < len(args):
        with open(args[idx + 1], "r", encoding="utf-8") as f:
            files.extend(line.strip() for line in f if line.strip())
else:
    files = args

bad_files = []

for file_name in files:
    if file_name in EXEMPTIONS or not os.path.isfile(file_name):
        continue
    try:
        with open(file_name, "r", encoding="utf-8", errors="ignore") as file_to_check:
            if VIOLATION_REGEX.findall(file_to_check.read()):
                bad_files.append(file_name)
    except (UnicodeDecodeError, OSError):
        pass

if len(bad_files):
    print("DO NOT SUBMIT found in:%s" % ("\n  - ".join([""] + bad_files)))
    exit(1)
