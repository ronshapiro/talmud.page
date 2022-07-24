#!/usr/bin/env python
# -*- coding: utf-8 -*-

import re
import sys

VIOLATION_REGEX = re.compile("[ -]+".join(["do", "not", "submit"]), re.I)
EXEMPTIONS = [".pre-commit-config.yaml", "pre-commit/check_do_not_submit.py"]

bad_files = []

for file_name in sys.argv:
    if file_name in EXEMPTIONS:
        continue
    with open(file_name, "r") as file_to_check:
        if VIOLATION_REGEX.findall(file_to_check.read()):
            bad_files.append(file_name)

if len(bad_files):
    print("DO NOT SUBMIT found in:%s" % ("\n  - ".join([""] + bad_files)))
    exit(1)
