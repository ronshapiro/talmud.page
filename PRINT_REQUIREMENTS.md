# Print layouts: supported features

What the print layouts (`/print`, code in `print/`) currently support. **Keep this file up to date:
every change that adds, removes or changes a capability updates it in the same commit.** Design
notes live in `print/README.md`.

## Common to both layouts

### Documents and versions
- Every configuration is a named *document* stored in the browser's IndexedDB.
- `?doc=<id>` selects the document; an unknown id creates a new document with that id. Several
  documents can be edited in parallel in different tabs.
- Toolbar: switch, rename, new, duplicate, export (JSON), import (JSON), delete. Edits save
  automatically.
- Documents from older versions are migrated automatically when opened.

### Pages and output
- Page size: presets (Pocket, A6, Digest, A5, Trade 6×9, Royal, Crown quarto, Letter, A4, Folio)
  or custom width/height, in inches or millimeters.
- Margins: top, bottom, inner (binding side) and outer; mirrored on facing pages.
- Binding direction: right (Hebrew book) or left.
- Views: spreads, single pages, or one spread at a time (← / → turn pages in reading direction);
  zoom; optional margin guides.
- Printing from the browser produces exactly the on-screen pages (`@page` size is set from the
  document). No blank trailing page.
- Offline PDF/PNG renderer: `print/cli/render_pdf.ts` (`--doc`, `--kind`, `--set`, `--out`,
  `--png-dir`, `--pages`, `--spreads`, `--scale`, `--offline`, `--url`, `--chrome`). It fails fast
  with the error if the layout can't load its text.
- Text is cached under `cached_outputs/print`; `--offline` renders without network access.

### Fonts
- Hebrew: Frank Ruehl CLM, Keter YG, Shofar, Hadasim CLM (Culmus); Ezra SIL; Frank Ruhl Libre,
  Noto Serif Hebrew, David Libre, Taamey David CLM, Cardo, Miriam Libre, Bellefair; Noto Rashi
  Hebrew (Rashi script); sans/display: Alef, Assistant, Heebo, Noto Sans Hebrew, Secular One,
  Suez One.
- English: EB Garamond, Cardo, Crimson Pro, Libre Baskerville, Libre Caslon Text, Lora,
  Source Serif 4, Spectral.
- All are bundled (open licenses, see `fonts/print/README.md`), so PDFs render identically offline.

## Siddur (`/print/siddur`)

### Text
- Editions: **Koren Shalem Siddur (Ashkenaz)** (default; Koren's Hebrew and English from Sefaria,
  135 sections) and Nusach Ashkenaz (Metsudah; curated weekday Shacharit, Kabbalat Shabbat,
  Shabbat evening, Birkat Hamazon). Sefard and the Koren Machzorim are registered but disabled.
- Choose which prayers to include; optionally start each prayer on a new page.
- **Koren Sacks Commentary**: Rabbi Sacks' commentary (Sefaria's *Rabbi Sacks on Siddur*), set at
  the foot of the page; can be edited, reset to Sefaria's text, suppressed, or entered by hand per
  segment.

### Layout options (per piece, segment, paragraph, section, or the whole document)
- Translation: side by side, Hebrew above English, Hebrew only, or English as footnotes.
- Lines: flowing prose, or each piece on its own line (sense lines), with hanging indents for
  wrapped lines only.
- Split at the source's own line breaks (Koren's sense lines), pairing Hebrew and English lines
  when they match.
- Automatic Hebrew line breaks after sentences or clauses.
- Alignment (Hebrew and English separately), indent, space before, size, new page before, keep
  with next, hidden, custom CSS.

### Editing
- Click any phrase on a page to edit it; scope tabs choose the level an option applies to.
- Word-level tools: split a segment into pieces (Hebrew and English split points), forced line
  breaks, bold/italic/size/letter-spacing/small caps/color/custom CSS on selected words, text
  corrections.

### Page layouts
- Single pages, or **facing pages** (Hebrew and English on opposite pages, Hebrew side
  configurable) with a title page.
- Hebrew and English lines align: first baselines are matched, and in facing mode (or with
  "English on the Hebrew line grid") English uses the Hebrew line pitch, so every line on a spread
  is level. English-only rubrics keep normal leading.
- Print spreads as single landscape pages.
- Running heads with the prayer's name; page numbers.

### Typography
- Hebrew and English fonts and sizes; line heights for Hebrew, English, notes and titles;
  instruction (rubric) and accent colors.

## Mikraot Gedolot (`/print/mikraot`)

### Text
- Any book of Tanakh. A document is a list of **sections**; each section covers a range of
  chapters or (for the Torah) a **parsha**, including double parshiyot.
- The same range can be rendered several times, each with its own commentaries, e.g. a parsha with
  only Rashi for reading, then again in depth. Each section can omit the source text, has an
  optional title, and can override where the translation goes. Sections start on a new page with
  their title (shown when there are several sections or a title is set).
- Aliyot are labelled in the text (ראשון … שביעי, מפטיר). In a parsha that is sometimes read with
  its neighbor, the combined reading's aliyah is noted where it differs ("במחוברות: רביעי"). Chapter
  ranges that cross parsha boundaries mark each parsha's start.
- Trope can be shown or hidden; petucha/setuma breaks; optional targum beside the text.

### Translation of the verses
- Choose any of Sefaria's translations of the book (English and other languages).
- Placement: in the notes, side by side, below the Hebrew, or none (per document or per section).
- Side by side, lines align with the Hebrew (same line pitch, paragraph gaps and heading heights;
  matched first baselines), which can be turned off. Aligned lines use the larger of the main
  text's and the translation's line pitch, so raising either line height spaces both.

### Commentaries
- Any commentary or targum that Sefaria links to the chapter and that is organized by verse can be
  added (66 for Genesis 1), plus any Sefaria title loaded by name. The sidebar lists the active
  commentaries; reorder, remove, and set per commentary:
  - prominence: primary (larger, fewer columns) or secondary;
  - English: none, footnote, Hebrew above English, side by side (optionally wrapping the English
    around the Hebrew, as a float), or in the continuations;
  - Hebrew and English font and size (falling back to the general settings);
  - a line limit.
- English-only commentaries (e.g. Rav Hirsch) are set in English.
- Per comment (click it on the page): hide, change prominence, turn its English on/off, line limit.
- Curation export/import (`mikraot-curation` JSON) for automated selection, per section.

### Long comments and continuations
- Line limits (per comment, per commentator, or global) apply to the Hebrew, to stacked and
  side-by-side English, and to footnotes, each separately. A block is cut after as many words as
  fit, so its marker fills out the last line. A cut block ends with a marker naming
  the addendum and the page it is on ("(המשך ב׳, עמ׳ 23)", "(continued in addendum 5,
  p. 23)").
- A comment whose English is set in the continuations can optionally carry a compact pointer to it
  ("ד׳·20"); off by default.
- The rest is set in a **Continuations** section at the end of each section, starting on the last
  page if there is room. Running heads list the verses continued on that page.
- Each continuation's heading names the commentator and verse, in a chosen format:
  "ע״ד. העמק דבר, פרק א׳ פסוק י״א (מעמ׳ 5)", "[ע״ד] העמק דבר - א:י״א", "[ע״ד] העמק דבר - א:י״א
  (עמ׳ 5)", "ע״ד. העמק דבר (א:י״א)", "א:י״א העמק דבר [ע״ד]", or a custom template with {n},
  {name}, {ref}, {cv} and {page}.
- Commentary continued from a previous page is headed with the verse it continues
  ("רמב״ן (המשך פסוק א׳)"); continued notes and translations are labelled "(cont.)".

### Layout
- Running head, main text, primary and secondary commentary (columns, and full-width rows for
  side-by-side commentaries, in the commentators' order), English notes at the foot, folio.
- Space-filling pagination with: column counts, gaps, maximum notes and main-text shares, a lag
  budget for long commentaries, a minimum page fill, column rules. Columns are balanced; widows and
  orphans are avoided; headings keep with their text.

### Hebrew and English labels
- **Hebrew-only mode**: no English in the output (translations, notes, labels) and no English
  options in the editor.
- Otherwise, switches for the English running head, chapter headings in the translation, section
  titles, the continuations title, and note labels (else Hebrew names).

### Markers and typography
- Verse numbers in the text, verse labels in commentary, and chapter headings: font, size, color,
  bold, raised, prefix, suffix, Hebrew or Arabic numerals.
- General fonts and sizes (main text, commentary by tier, commentary English, targum, notes).
- Line heights for main text, targum, verse translation, commentary, commentary English, notes and
  commentary headings.

## Known limitations
- Chrome occasionally stretches letters on a justified Hebrew line; Siddur defaults are ragged.
- A Hebrew comment set as a float (wrapped side by side) taller than ~45% of the page is set as a
  plain side-by-side row instead.
