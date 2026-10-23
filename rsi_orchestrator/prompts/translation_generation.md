<!--
First-turn prompt for translating one Rashi/Tosafot comment (rashi_tosafot_translation.ts's
generationPrompt). Everything before "Worked examples" is static, so it stays a cacheable prefix.
Params: workedExamples, pageIndex, targetComment, priorFeedback (optional).
-->
# Instructions (ID: TRANSLATION_TASK)

You're translating and punctuating a single commentary comment on the Talmud, for talmud.page (an interactive study tool).

## Tasks

1. Add punctuation to the Hebrew comment if it doesn't already have it (Rashi/Tosafot style: a hyphen separates the dibbur hamatchil from the comment body, and the comment ends with a colon, not a period).
   - **Abbreviations**: When confident what an abbreviation stands for, expand it using `<abbr title="expansion">abbreviation</abbr>`. Keep the exact original abbreviation text inside the tag and put the expanded meaning in the `title` attribute. Example: `<abbr title="בפרק">בפ'</abbr>`, `<abbr title="אלא אם כן">אא"כ</abbr>`, `<abbr title="עשרים ואחת">כ"א</abbr>`, `<abbr title="שבעה">ז'</abbr>`, `<abbr title="עליו השלום">ע"ה</abbr>`. Do NOT alter the abbreviation text itself.
     - **Numerals**: Add `<abbr>` tags for regular numbers in text that represent counts or quantities (e.g. `<abbr title="שבעת">ז'</abbr> ימים`, `<abbr title="ארבעה">ד'</abbr> אבות`, `<abbr title="עשרים ואחת">כ"א</abbr> תקיעות`). Do NOT add `<abbr>` tags to Hebrew numerals that refer to page, daf, or chapter numbers (e.g. leave `דף ב.`, `פרק ד'`, `בפ' ד' אחין` as-is).
     - **Leave untouched without `<abbr>` tags**:
       - Truncation markers: וגו' and וכו' (or כו').
       - Opening section headers: מתני' and גמ' when they appear as the first word / dibbur hamatchil of a comment.
       - Page, daf, and chapter reference numbers (e.g. דף י"ב, פרק ד').
       - Universal divine names, standard acronyms, and honorifics: הקב"ה, ה'/'ד, רש"י, חז"ל, ז"ל, זצ"ל.
   - **Explanations**: If brief explanatory or contextual words are needed in the Hebrew to make the thought coherent (e.g. an implied subject or verb), wrap them in `<span class="explanation">...</span>`. Do NOT use brackets (`[...]`) for explanations, because brackets are used in printed editions for textual emendations.
   - **Fidelity**: Outside of `<span class="explanation">...</span>`, preserve the exact source text wording without adding, removing, or changing any words. Preserve existing HTML tags around the same words.
   - Omit the Hebrew field entirely if it would be identical to the source.
2. Write an accurate, readable English translation.
3. If the existing translation is in French, German, or Spanish rather than English, translate that into English instead of writing a fresh translation.

## Rules on tools and external lookups

- The ONLY permitted CLI tool is context_fetch_cli (`npx ts-node rsi_orchestrator/context_fetch_cli.ts ...`).
- You must NOT execute `git`, `python`, arbitrary node execution (such as `node -e`), or arbitrary bash commands/scripts (e.g. cat, diff, echo to file). Any attempt to run git, python, or other unapproved commands is blocked and will abort your attempt.
- Do NOT attempt to output your response via `node` or bash. Output your JSON response directly as text in your message.
- You must NOT make any lookups to Sefaria (sefaria.org). External lookups to sefaria.org are strictly forbidden and blocked.
- Wikipedia checks ARE permitted (via `npx ts-node rsi_orchestrator/context_fetch_cli.ts wikipedia ...` or curl to wikipedia.org) if needed for realia, botanical/zoological terms, historical figures, or French loanwords.
- If context_fetch_cli or Wikipedia does not provide what you need, do not seek it elsewhere — translate based on the provided text and your own knowledge.

## Context lookups

The Gemara segment this comment is attached to is given below with the comment. For most comments, that is all the context you need. Fetch more only when a specific question about THIS comment's meaning can't be answered without it. Fetched refs are recorded as dependencies of your translation, so unneeded fetches trigger needless re-translation later.

Typical reasons to fetch, and how to find the right ref:

- The comment continues the previous comment on the same segment (it starts mid-thought, or with כלומר / והכי קאמר) -> get-refs on that comment. Comment refs are the segment ref plus :N, numbered in order (e.g. "Rashi on X 10a:3:2" follows "Rashi on X 10a:3:1").
- The comment points back to something said earlier (לעיל, כדאמרן, כדפרישית, מתניתין, etc.) -> get-neighbors on the attached segment with --before N, starting small (N=3) and widening only if you haven't found it yet. It continues into the previous amud automatically, so you never need to guess how many segments an adjacent amud has. To see where the current discussion began, use get-prior-sugyot. Each sugya it returns has a `range` you can search without fetching its text.
- The comment explains a phrase that comes after its own segment -> get-neighbors --after N.
- The comment refers to a passage on another page, and you can't translate it without seeing that passage:
  1. If the page index shows Mesorat Hashas on the attached segment, run get-comment-refs on the segment to get its parallel passages. Ranges like "Sukkah 53b:7-9" work as-is in both get-refs and search.
  2. If the comment gives a citation (e.g. "(סוכה דף נג:)" = Sukkah 53b, "נג." = 53a) that no parallel covers, that page is where to look.
  3. With no parallel and no citation, rely on your own knowledge. Don't search pages on a guess.
- The comment quotes a verse, or relies on another commentary listed on its segment in the page index (Verses, Mishnah, Tosefta, Jastrow, etc.) -> get-comment-refs on the segment, then get-refs with `--on "<segment ref>"` for the ones you need. Only Rashi, Tosafot, and Steinsaltz refs follow a predictable pattern; get every other ref from get-comment-refs rather than guessing.
- Old French glosses (לע"ז): if "Commentary on this comment" lists Otzar Laazei Rashi, get-refs that ref with `--on "<comment ref>"`. It identifies the French word and what it means. Otherwise -> wikipedia.
- Realia, plants, animals, historical figures -> wikipedia.

Prefer search over fetching long passages. When you're looking for where a particular word, phrase, or dibbur hamatchil appears (in a parallel, a sugya range, or a page), search for it and then get-refs only the segment that matches. Search covers the Gemara plus Rashi and Tosafot by default; pass --commentary to search other commentaries listed in the page index instead (e.g. `--commentary Ritva Rashba`). Fetch a whole passage only when you need to follow its argument. Pass --lang he when the Hebrew wording is enough: the English is often several times longer.

Do NOT fetch other comments to calibrate style or to see how comments are usually punctuated or translated. The worked examples below are the style reference, and comments from elsewhere in the tractate (e.g. its first comments on 2a) say nothing about this one. Never guess at refs. Use a ref from the page index below, one returned by an earlier fetch, or get-neighbors.

context_fetch_cli commands (each call is size-capped):

```
npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs '["<ref>", ...]' [--lang he|en|both] [--on "<segment ref>"]
npx ts-node rsi_orchestrator/context_fetch_cli.ts get-comment-refs "<segment ref>" [--commentary "<name>"]
npx ts-node rsi_orchestrator/context_fetch_cli.ts get-neighbors "<segment ref>" [--before N] [--after N]
npx ts-node rsi_orchestrator/context_fetch_cli.ts get-prior-sugyot "<any ref on this page>" [--count N]
npx ts-node rsi_orchestrator/context_fetch_cli.ts search "<page or segment range, e.g. Sukkah 53b or Sukkah 53b:7-54a:2>" "<word or phrase>" [--commentary <name> ...]
npx ts-node rsi_orchestrator/context_fetch_cli.ts wikipedia "<topic>" [--lang en|he]
```

## Response format

Respond with ONLY a JSON object matching {"hebrew"?: string, "english"?: string} — include a key only if you're proposing a change to it. No other text before or after the JSON.

### Hebrew markup and formatting example

- Source Hebrew: `מתני' כ"א תקיעות מפרש להו בפ' החליל`
- Punctuated Hebrew: `<strong class="dibur-hamatchil">מתני'</strong> - <abbr title="עשרים ואחת">כ"א</abbr> תקיעות, <span class="explanation">הגמרא</span> מפרש להו <abbr title="בפרק">בפ'</abbr> החליל:`
- English translation: `<strong class="dibur-hamatchil">The Mishnah:</strong> Twenty-one blasts — [the Gemara] explains them in the chapter [entitled] Hechalil:`

## Worked examples

Worked example(s) of the expected output — punctuation style, and how literal vs. free the English translation should be:

{{workedExamples}}

## Page index (segment refs and comment counts, not text)

{{pageIndex}}

## Target commentary comment to translate

{{targetComment}}

{{priorFeedback}}
