#!/usr/bin/env python3
"""
Generates an SFT (Supervised Fine-Tuning) dataset from all talmud.page RSI generation records
and precomputed AI additions.

Creates both:
1. Generation tasks: Translate and punctuate Talmud commentary comments into structured JSON.
2. Critique tasks: Evaluate proposed edits (balanced positive and negative examples).

Outputs standard ChatML / OpenAI / Gemma chat format:
{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
"""

import glob
import json
import os
import random
from typing import Any, Dict, List

RANDOM_SEED = 42
random.seed(RANDOM_SEED)

def build_generation_user_prompt(ref: str, source_hebrew: str) -> str:
    return f"""Instructions (ID: TRANSLATION_TASK):
You're translating and punctuating a single commentary comment on the Talmud, for talmud.page (an interactive study tool).

Tasks:
1. Add punctuation to the Hebrew comment if it doesn't already have it (Rashi/Tosafot style: a hyphen separates the dibbur hamatchil from the comment body, and the comment ends with a colon, not a period). Expand abbreviations only if you're confident what they stand for. Don't change the source text otherwise. Preserve existing HTML tags around the same words. Omit the Hebrew field entirely if it would be identical to the source.
2. Write an accurate, readable English translation.
3. If the existing translation is in French, German, or Spanish rather than English, translate that into English instead of writing a fresh translation.

No tools or lookups are available in this environment — translate from the provided text and your own knowledge.

Response format:
Return a SINGLE json code fence containing the edit:
```json
{{
  "hebrew": "optional punctuated Hebrew (omit if identical to source)",
  "english": "English translation (required)"
}}
```

Target comment to translate:
Ref: {ref}
Hebrew: {source_hebrew}"""

def build_generation_assistant_response(hebrew: str, english: str, source_hebrew: str) -> str:
    response_obj: Dict[str, str] = {}
    if hebrew and hebrew != source_hebrew:
        response_obj["hebrew"] = hebrew
    if english:
        response_obj["english"] = english
    return f"```json\n{json.dumps(response_obj, ensure_ascii=False, indent=2)}\n```"

def build_critique_user_prompt(original_hebrew: str, proposed_hebrew: str, proposed_english: str) -> str:
    return f"""Instructions (ID: CRITIQUE_TASK):
You proposed this edit to a Talmud commentary comment. Check it before it ships.

Does the proposed Hebrew preserve the exact wording (only punctuation/HTML changed, no words added, removed, or changed)? Is the English translation accurate to the Hebrew?

No lookups to sefaria.org or arbitrary bash/scripts (e.g. no python, no node, no cat/diff/file creation) are permitted. All text comparison must be performed directly in your own reasoning. Wikipedia lookups are permitted if needed.

Be extremely terse to minimize token usage. Output ONLY a concise JSON decision with no preamble or commentary:
- If valid: {{"valid": true}}
- If invalid: {{"valid": false, "reason": "<brief one-sentence reason>"}} so generation can retry.
Keep any rejection reason to a single brief sentence. Do not include verbose commentary, apologies, or full rewrites.

Target comment to check:
Original Hebrew: {original_hebrew}
Proposed Hebrew: {proposed_hebrew or '(unchanged)'}
Proposed English: {proposed_english or '(none)'}"""

def create_dataset(output_path: str = "precomputed/rsi_state/sft_dataset.jsonl") -> Dict[str, int]:
    records_files = sorted(glob.glob("precomputed/rsi_state/generation_records/rashi_tosafot_translation/*.json"))

    generation_examples: List[Dict[str, Any]] = []
    positive_critique_examples: List[Dict[str, Any]] = []
    negative_critique_examples: List[Dict[str, Any]] = []

    all_pairs: List[Dict[str, str]] = []

    for rf in records_files:
        page_name = os.path.basename(rf)
        ai_path = os.path.join("precomputed/ai_additions", page_name)
        if not os.path.exists(ai_path):
            continue

        with open(rf, "r", encoding="utf-8") as f_r, open(ai_path, "r", encoding="utf-8") as f_a:
            try:
                gen_data = json.load(f_r)
                ai_data = json.load(f_a)
            except Exception:
                continue

        for ref, rec in gen_data.items():
            if not isinstance(rec, dict):
                continue
            source_text = rec.get("sourceText", "")
            if not source_text:
                continue

            ai_entry = ai_data.get(ref)
            if not ai_entry or not isinstance(ai_entry, dict):
                continue

            target_hebrew = ai_entry.get("hebrew", "")
            target_english = ai_entry.get("english", "")
            if not target_english:
                continue

            all_pairs.append({
                "ref": ref,
                "source_text": source_text,
                "target_hebrew": target_hebrew,
                "target_english": target_english,
            })

    # 1. Build generation examples
    for item in all_pairs:
        user_msg = build_generation_user_prompt(item["ref"], item["source_text"])
        asst_msg = build_generation_assistant_response(item["target_hebrew"], item["target_english"], item["source_text"])
        generation_examples.append({
            "task": "generation",
            "ref": item["ref"],
            "messages": [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": asst_msg},
            ]
        })

    # 2. Build positive critique examples
    for item in all_pairs:
        user_msg = build_critique_user_prompt(item["source_text"], item["target_hebrew"], item["target_english"])
        asst_msg = json.dumps({"valid": True})
        positive_critique_examples.append({
            "task": "critique_positive",
            "ref": item["ref"],
            "messages": [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": asst_msg},
            ]
        })

    # 3. Build negative critique examples (simulated common generator errors)
    # Types of corruptions:
    # A: Altered Hebrew wording (added extraneous word or deleted words)
    # B: Swapped English (mismatched translation)
    # C: Missing English translation
    # D: Truncated English
    for i, item in enumerate(all_pairs):
        corruption_type = i % 3

        if corruption_type == 0:
            # Corrupted Hebrew: prepend or append extra words to the Hebrew body
            words = item["source_text"].split()
            if len(words) > 4:
                # remove a word or insert a foreign word
                corrupted_hebrew = " ".join(words[:2] + ["פירוש", "אחר"] + words[4:])
            else:
                corrupted_hebrew = item["source_text"] + " נוסף"
            user_msg = build_critique_user_prompt(item["source_text"], corrupted_hebrew, item["target_english"])
            asst_msg = json.dumps({
                "valid": False,
                "reason": "Proposed Hebrew text altered the original wording beyond punctuation."
            })
        elif corruption_type == 1:
            # Swapped English: pick English from a completely different comment
            mismatch_idx = (i + len(all_pairs) // 2) % len(all_pairs)
            swapped_english = all_pairs[mismatch_idx]["target_english"]
            user_msg = build_critique_user_prompt(item["source_text"], item["target_hebrew"], swapped_english)
            asst_msg = json.dumps({
                "valid": False,
                "reason": "The English translation does not match the commentary text."
            })
        else:
            # Missing or empty English
            user_msg = build_critique_user_prompt(item["source_text"], item["target_hebrew"], "")
            asst_msg = json.dumps({
                "valid": False,
                "reason": "Missing English translation."
            })

        negative_critique_examples.append({
            "task": "critique_negative",
            "ref": item["ref"],
            "messages": [
                {"role": "user", "content": user_msg},
                {"role": "assistant", "content": asst_msg},
            ]
        })

    # Combine and shuffle
    all_examples = generation_examples + positive_critique_examples + negative_critique_examples
    random.shuffle(all_examples)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f_out:
        for ex in all_examples:
            f_out.write(json.dumps(ex, ensure_ascii=False) + "\n")

    return {
        "generation": len(generation_examples),
        "critique_positive": len(positive_critique_examples),
        "critique_negative": len(negative_critique_examples),
        "total": len(all_examples),
    }

if __name__ == "__main__":
    stats = create_dataset()
    print("SFT Dataset generated successfully:")
    for k, v in stats.items():
        print(f"  {k}: {v}")
