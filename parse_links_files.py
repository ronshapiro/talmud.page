from masechtot import MASECHTOT as MASECHTOT_ALIASES
import json
import os
import re
import tanach

MASECHTOT = MASECHTOT_ALIASES.keys()

COMMENTARY_PATTERNS = {
    "Chiddushei Ramban on {masechet}": "ramban",
    "Rashba on {masechet}": "rashba",
}

def _create_commentary_targets():
    targets = {}
    for masechet in MASECHTOT:
        for pattern, alias in COMMENTARY_PATTERNS.items():
            targets[pattern.format(masechet=masechet)] = alias
    return targets

COMMENTARY_TARGETS = _create_commentary_targets()

SEFARIA_INDEX_SUFFIX = re.compile(" \d{0,3}[ab:\d-]*$")

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

gemara_commentary_links = {}
def _scan_for_gemara_commentary_links(source, target):
    source, source_label = _extract_book_and_index(source)
    target, target_label = _extract_book_and_index(target)
    if source in MASECHTOT and target in COMMENTARY_TARGETS:
        target_label_index = int(target_label.split(":")[1])
        _append_to_list_in_nested_dict(
            gemara_commentary_links,
            (source, source_label, COMMENTARY_TARGETS[target]),
            target_label_index)

biblical_links = {}
def _scan_for_biblical_links(source_with_label, target_with_label, source_book, target_book):
    if source_book not in MASECHTOT or target_book not in tanach.BOOKS:
        return

    source, source_label = _extract_book_and_index(source_with_label)
    target, target_label = _extract_book_and_index(target_with_label)
    target_label_pieces = target_label.split(":")
    if len(target_label_pieces) is not 2:
        # Are entire chapters meant to be quoted?
        return
    chapter = int(target_label_pieces[0])
    verse_range = target_label_pieces[1].split("-")
    for verse in range(int(verse_range[0]), int(verse_range[-1]) + 1):
        _append_to_list_in_nested_dict(
            biblical_links,
            (source, source_label),
            {"book": target,
             "chapter": chapter - 1,
             "verse": verse - 1})

for i in range(8):
    with open("sefaria-data/links/links%s.csv" % i, "r") as f:
        # ignore header line:
        # Citation 1,Citation 2,Conection Type,Text 1,Text 2,Category 1,Category 2
        f.readline()

        for line in f:
            parts = line.split(",")
            _scan_for_gemara_commentary_links(*parts[:2])
            _scan_for_biblical_links(*parts[:2], *parts[3:5])

with open("sefaria-data/gemara-commentary-links.json", "w") as output:
    json.dump(gemara_commentary_links, output)
with open("sefaria-data/gemara-biblical-links.json", "w") as output:
    json.dump(biblical_links, output)
