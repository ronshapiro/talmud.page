#!/usr/bin/env python3
"""
Generates a pretraining / domain-adaptation dataset from cached Talmud text
and Steinsaltz explanations in Hebrew and English.

Creates instruction-tuning and alignment pairs:
1. Talmud Hebrew -> Steinsaltz Hebrew explanation (ביאור שטיינזלץ)
2. Talmud Hebrew -> Steinsaltz English translation and elucidation

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

def build_steinsaltz_hebrew_prompt(ref: str, talmud_hebrew: str) -> str:
    return f"""באר והסבר את קטע התלמוד הבא בעברית (ביאור שטיינזלץ):

מקור: {ref}
{talmud_hebrew}"""

def build_steinsaltz_english_prompt(ref: str, talmud_hebrew: str) -> str:
    return f"""Translate and elucidate the following Talmud passage in English (Steinsaltz translation):

Ref: {ref}
{talmud_hebrew}"""

def extract_pairs_from_cached_file(file_path: str) -> List[Dict[str, Any]]:
    examples: List[Dict[str, Any]] = []
    try:
        with open(file_path, "r", encoding="utf-8") as cached_file:
            data = json.load(cached_file)
    except Exception:
        return []

    if not isinstance(data, dict):
        return []

    sections = data.get("sections", [])
    for section in sections:
        if not isinstance(section, dict):
            continue

        ref = section.get("ref", "")
        talmud_hebrew = section.get("he", "")
        steinsaltz_english = section.get("en", "")

        commentaries = section.get("commentary", {})
        steinsaltz_comments = commentaries.get("Steinsaltz", {}).get("comments", [])
        steinsaltz_hebrew = " ".join(
            comment.get("he", "").strip() for comment in steinsaltz_comments if comment.get("he")
        ).strip()

        if not talmud_hebrew:
            continue

        # 1. Talmud -> Steinsaltz English explanation
        if steinsaltz_english:
            user_message = build_steinsaltz_english_prompt(ref, talmud_hebrew)
            examples.append({
                "task": "talmud_steinsaltz_english",
                "ref": ref,
                "messages": [
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": steinsaltz_english},
                ],
            })

        # 2. Talmud -> Steinsaltz Hebrew explanation
        if steinsaltz_hebrew:
            user_message = build_steinsaltz_hebrew_prompt(ref, talmud_hebrew)
            examples.append({
                "task": "talmud_steinsaltz_hebrew",
                "ref": ref,
                "messages": [
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": steinsaltz_hebrew},
                ],
            })

    return examples

def create_pretrain_dataset(
    output_path: str = "precomputed/rsi_state/pretrain_dataset.jsonl",
    limit_files: int = 500,
) -> Dict[str, int]:
    all_cached_files = sorted(glob.glob("cached_outputs/api_request_handler/*.json"))
    # Filter for Talmud page files (contain a period and numbers, e.g. "Berakhot.2a.json")
    talmud_files = [
        path for path in all_cached_files
        if "." in os.path.basename(path) and any(character.isdigit() for character in os.path.basename(path))
    ]

    if limit_files and limit_files > 0:
        talmud_files = talmud_files[:limit_files]

    all_examples: List[Dict[str, Any]] = []
    english_count = 0
    hebrew_count = 0

    for file_path in talmud_files:
        extracted = extract_pairs_from_cached_file(file_path)
        for example in extracted:
            if example["task"] == "talmud_steinsaltz_english":
                english_count += 1
            elif example["task"] == "talmud_steinsaltz_hebrew":
                hebrew_count += 1
            all_examples.append(example)

    random.shuffle(all_examples)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as output_file:
        for example in all_examples:
            output_file.write(json.dumps(example, ensure_ascii=False) + "\n")

    return {
        "talmud_files_processed": len(talmud_files),
        "steinsaltz_english_pairs": english_count,
        "steinsaltz_hebrew_pairs": hebrew_count,
        "total_examples": len(all_examples),
    }

if __name__ == "__main__":
    statistics = create_pretrain_dataset()
    print("Pretrain Steinsaltz Dataset generated successfully:")
    for key, value in statistics.items():
        print(f"  {key}: {value}")
