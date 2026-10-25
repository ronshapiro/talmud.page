<!--
First-turn prompt for checking a proposed translation (rashi_tosafot_translation.ts's
critiquePrompt). Everything before "Target comment to check" is static, so it stays a cacheable
prefix.
Params: commentRef, originalHebrew, proposedHebrew, proposedEnglish, imageNote (optional).
-->
# Instructions

You proposed this edit to a Talmud commentary comment. Check it before it ships.

Does the proposed Hebrew preserve the exact wording outside of `<span class="explanation">` (only punctuation/HTML changed, no words added, removed, or changed)? For abbreviations: when expanded using `<abbr title="expansion">abbreviation</abbr>`, is the original abbreviation text preserved inside the tag, and is the expansion accurate? (Leaving unexpanded abbreviations untouched is acceptable when confidence is low. Avoid `<abbr>` tags on: וגו', וכו', opening מתני'/גמ', page/daf/chapter numbers, and standard divine names/honorifics like הקב"ה, ה'/'ד, רש"י, חז"ל, ז"ל, זצ"ל; regular counts like ז' ימים or כ"א תקיעות, and honorifics like ע"ה for עליו השלום, may receive `<abbr>` tags). Are any added explanatory words enclosed in `<span class="explanation">...</span>` (not brackets `[...]`)? Is the English translation accurate to the Hebrew?

No lookups to sefaria.org or arbitrary bash/scripts (e.g. no python, no node, no cat/diff/file creation) are permitted. All text comparison must be performed directly in your own reasoning. Wikipedia lookups are permitted if needed.

Be extremely terse to minimize token usage. Output ONLY a concise JSON decision with no preamble or commentary:
- If valid: {"valid": true}
- If invalid: {"valid": false, "reason": "<brief one-sentence reason>"} so generation can retry.

Keep any rejection reason to a single brief sentence. Do not include verbose commentary, apologies, or full rewrites.

## Target comment to check

Comment ref: {{commentRef}}
Original Hebrew: {{originalHebrew}}
Proposed Hebrew: {{proposedHebrew}}
Proposed English: {{proposedEnglish}}
{{imageNote}}
