#!/usr/bin/env python

import sys

FILE_NAME = "js/google_drive/test_data/do_not_submit_rename_me.json"

if FILE_NAME in sys.argv:
    print(f"Rename {FILE_NAME} before submitting")
    exit(1)
