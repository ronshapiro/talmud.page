<!--
Follow-up turn in a long-thread session (long_thread_session.ts's continuationCritiquePrompt):
translation_critique.md was already sent earlier in the same thread.
Params: commentRef, originalHebrew, proposedHebrew, proposedEnglish, imageNote (optional).
-->
## Target comment to check

Comment ref: {{commentRef}}
Original Hebrew: {{originalHebrew}}
Proposed Hebrew: {{proposedHebrew}}
Proposed English: {{proposedEnglish}}
{{imageNote}}

Evaluate whether this proposed edit is valid according to the critique criteria:
- Does the proposed Hebrew preserve the exact wording outside of `<span class="explanation">` (only punctuation/HTML changed, no words added, removed, or changed)?
- Are abbreviations marked with `<abbr title="expansion">abbreviation</abbr>` with the original abbreviation preserved inside the tag, and is the expansion accurate?
- In the proposed Hebrew, are any newly added explanatory words enclosed in `<span class="explanation">...</span>` (not newly added brackets `[...]`), while any square brackets `[...]` that already appeared in the original Hebrew source text are allowed and preserved as-is? (do NOT reject for keeping source-text square brackets.)
- Is the English translation accurate to the Hebrew (using square brackets `[...]` — not `<span class="explanation">` — for brief implied or explanatory words in English)?

No lookups or arbitrary scripts/tools are permitted. All text comparison must be performed directly in your own reasoning.

Output ONLY a concise JSON decision with no preamble or commentary:
- If valid: {"valid": true}
- If invalid: {"valid": false, "reason": "<brief one-sentence reason>"} so generation can retry.
