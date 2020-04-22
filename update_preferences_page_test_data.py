#!/usr/bin/python
# -*- coding: utf-8 -*-

import json
import requests

section = requests.get("http://localhost:5000/api/Brachot/2a").json()["sections"][0]

with open("js/preferences_sample_data.js", "w") as f:
    f.write("const createTestData = () => %s;" % json.dumps([section]))
    f.write("\n");
