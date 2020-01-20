import json
import os
import re
from masechtot import MASECHTOT as MASECHTOT_ALIASES

MASECHTOT = MASECHTOT_ALIASES.keys()

TARGET_PATTERNS = {
    "Chiddushei Ramban on {masechet}": "ramban",
    "Rashba on {masechet}": "rashba",
}

def _create_desired_targets():
    targets = {}
    for masechet in MASECHTOT:
        for pattern, alias in TARGET_PATTERNS.items():
            targets[pattern.format(masechet=masechet)] = alias
    return targets

DESIRED_TARGETS = _create_desired_targets()

SEFARIA_INDEX_SUFFIX = re.compile(" \d{0,3}[ab]:\d+$")

def _extract_book_and_index(string):
    matches = SEFARIA_INDEX_SUFFIX.findall(string)
    if len(matches) is 0:
        return (None, None)

    suffix = matches[-1]
    return (
        string[:-1 * len(suffix)],
        suffix[1:], # strip leading space
    )

def _append_to_list_in_nested_dict(root, keys, value):
    current = root
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]

    lastKey = keys[-1]
    if lastKey not in current:
        current[lastKey] = []
    current[lastKey].append(value)

forward_links = {}
for i in range(8):
    with open("sefaria-data/links/links%s.csv" % i, "r") as f:
        # ignore header line:
        # Citation 1,Citation 2,Conection Type,Text 1,Text 2,Category 1,Category 2
        f.readline()

        for line in f:
            source, target = line.split(",")[:2]
            source, source_label = _extract_book_and_index(source)
            target, target_label = _extract_book_and_index(target)
            if source in MASECHTOT and target in DESIRED_TARGETS:
                target_label_index = int(target_label.split(":")[1])
                _append_to_list_in_nested_dict(
                    forward_links,
                    (source, source_label, DESIRED_TARGETS[target]),
                    target_label_index)

with open("sefaria-data/parsed-links.json", "w") as output:
    json.dump(forward_links, output)
