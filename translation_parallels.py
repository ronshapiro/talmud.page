import json
import re
import statistics
from masechtot import MASECHTOT
from masechtot import next_amud

SENTENCE_ENDING_CHARACTERS = set(["!", "?", "."])
SENTENCE_END_IN_MIDDLE = re.compile("[!?\\.] ")

def count_sentences(text):
    # The arbitrary + 1 assumes that each segment ends in a sentence, or it's the end of the amud
    # in which case both translations both end in a parallel sentence fragment
    return len(SENTENCE_END_IN_MIDDLE.findall(text)) + 1

for masechet in MASECHTOT:
    amud = masechet.start
    sentence_count_diffs = []
    while True:
        file_path = f"cached_outputs/api_request_handler/{masechet.canonical_name}.{amud}.json"
        with open(file_path, "r") as input_file:
            sections = json.load(input_file)["sections"]
            for section in sections:
                if "hadran" in section and section["hadran"]:
                    continue
                if "Steinsaltz" not in section["commentary"]:
                    continue # Some sections don't have Steinsaltz due to Sefaria bugs
                sentence_count_diffs.append(
                    count_sentences(section["en"])
                    - count_sentences(section["commentary"]["Steinsaltz"]["comments"][0]["he"]))
        if amud == masechet.end:
            break
        amud = next_amud(amud)
    print(f"{masechet.canonical_name}: ")
    num_zeros = len(list(filter(lambda x: x == 0, sentence_count_diffs)))
    print(f"{num_zeros} / {len(sentence_count_diffs)} = {num_zeros / len(sentence_count_diffs)}")
    print(f"Max: {max(sentence_count_diffs)}")
    print(f"Min: {min(sentence_count_diffs)}")
    print(f"Mean: {sum(sentence_count_diffs) / len(sentence_count_diffs)}")
    print(f"Standard deviation: {statistics.stdev(sentence_count_diffs)}")
    print()
print("Finished!")
