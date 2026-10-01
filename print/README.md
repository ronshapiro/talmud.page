# Print layouts

Print-ready, paginated renderings of the texts that talmud.page shows on the web. Two layouts:

1. **Siddur** (`/print/siddur`) — a Koren-Sacks–inspired siddur that emphasizes whitespace and
   creative line layouts.
2. **Mikraot Gedolot** (`/print/mikraot`) — a customizable, uncrowded Mikraot Gedolot with the
   English translations set small at the bottom of the page like footnotes.

Pages can be viewed one-by-one (or as spreads) in the browser, printed directly from the browser,
or rendered offline to PDF with `npx ts-node print/cli/render_pdf.ts`.

## Goals and non-goals

- **WYSIWYG**: the browser view and the PDF are produced by the *same* layout engine running in the
  *same* browser engine, so what you see on screen is what prints.
- **Configurable geometry**: page size (presets + custom), margins (inner/outer for binding),
  binding direction, font sizes.
- **Multiple documents in parallel**: every configuration lives in a named *document* stored in the
  browser's IndexedDB and selected with the `?doc=<id>` URL parameter. Documents can be duplicated,
  exported to JSON and imported (which is how the offline PDF renderer receives them).
- **Offline**: source text is fetched through the server, which caches to
  `cached_outputs/print/...`. The PDF CLI serves from that cache, so once a document has been
  rendered once it can be re-rendered without network access.
- Non-goal (for now): hand-tuned typesetting à la TeX (Knuth–Plass line breaking, micro-typography).
  We rely on the browser's line breaking and keep the pagination logic ours.

## Architecture

```
print/
  model/        Pure data types + transforms (no DOM). Unit-testable in jest.
    geometry.ts         Page sizes, margins, unit conversion.
    richText.ts         HTML -> token list (words + marks) -> HTML slices. The basis for
                        splitting paragraphs across columns/pages *and* for word-level editing
                        (line breaks, segment splits, inline styles).
    documents.ts        Document schema (SiddurDocument | MikraotDocument), defaults, migrations.
    siddurModel.ts      Siddur source data + overrides -> render blocks.
    mikraotModel.ts     Mikraot source data + config -> streams of commentary blocks.
  layout/       DOM measurement + pure-arithmetic packing.
    measure.ts          Off-screen measurement. Each block is measured once per width, producing
                        its line boxes (bottom offset + first token per line).
    packing.ts          Packs measured blocks into columns (balanced or greedy) with line-level
                        splitting, widow/orphan control and keep-with-next.
    siddurPaginator.ts  Siddur pages.
    mikraotPaginator.ts Mikraot Gedolot pages.
  ui/           React components: page view, toolbars, editors, document picker.
  store/        IndexedDB document store (one DB, one object store keyed by document id).
  server/       Express routes for print data (Sefaria fetch + transforms + disk cache).
  cli/          Offline PDF renderer (playwright-core driving Chrome/Chromium).
```

### Layout engine

Every piece of text is converted to a **token list** (`richText.ts`): one token per word, each
carrying the stack of inline elements ("marks": `<b>`, `<small>`, `<span class=…>`, user styles)
that enclose it. A block is measured off-screen by rendering every token in a `<span data-t=i>`;
reading each span's offset gives the **line boxes** of the block at that width in one layout pass.
From then on, pagination is arithmetic: "how many lines of this block fit in 143px?" is a binary
search over the line bottoms, and the HTML for "lines 4–9" is regenerated from the token range.
Because a fragment always starts at a line start and has the same width, the browser reproduces
the same line breaks when the fragment is rendered for real. Non-final fragments of justified
text get `text-align-last: justify` so their last line stays justified.

### Siddur

Hierarchy: **document → sections** (e.g. *Birchot Kriat Shema*) **→ paragraphs → segments →
pieces** (after user splits). Each level can carry an override; the effective value is resolved
from the most specific level that sets it (piece > segment > paragraph > section > document).

Per-level options:

| Option | Values |
| --- | --- |
| `translation` | `side-by-side`, `stacked` (Hebrew on top, English below), `hebrew-only`, `footnote` (English as a footnote) |
| `lineMode` | `prose` (segments flow together), `lines` (each piece starts a new line — sense lines) |
| `align`, `indent`, `spaceBefore`, `pageBreakBefore`, `keepWithNext`, `hidden` | layout tweaks |
| `splits` | token indices at which a segment is split into pieces (Hebrew and English independently) |
| `lineBreaks` | token indices at which to force a line break |
| `styles` | inline style ranges over tokens: bold, italic, size scale, color, letter-spacing, free CSS |

Editions (`ashkenaz` today; `sefard`, `koren-sacks-machzor-*` registered but disabled) map a
section id to a data source: either a curated talmud.page siddur page (`/api/SiddurAshkenaz/...`,
which already has segment merging, explanations and cleanup) or a raw Sefaria ref (for the parts
of *Siddur Ashkenaz* that talmud.page doesn't curate yet, e.g. Kabbalat Shabbat).

Commentary: a new commentary type, **Koren Sacks Commentary** (`koren-sacks`), is registered in
`commentaries.ts`. Its content is not available from Sefaria, so it is entered per segment in the
editor and stored in the document; it is set at the bottom of the page in a notes area shared with
English footnotes.

### Mikraot Gedolot

Page anatomy (top to bottom): running head · main text (verses, optionally with Targum) ·
commentary regions · English notes.

- **Commentaries** are *streams* (one per commentator), each with a `tier` (1 = foundational,
  2 = secondary, 0 = hidden) and `showEnglish`. Tier-1 streams are set larger, in fewer columns;
  tier-2 smaller, in more columns. Individual comments can also be hidden or re-tiered
  (`commentOverrides`) — this is the hook for the future AI curation step.
- **English notes** (verse translation + English of commentators with `showEnglish`) are a separate
  stream at the bottom, in small type, grouped by commentator and labeled by verse, so pages look
  balanced even when only some commentators have English.
- **Pagination** is greedy-with-lookahead: keep adding verses while the page's main text, the
  commentary on those verses (plus anything carried over), and the English notes all fit. If the
  page would otherwise be left more than ~25% empty, take one more verse and let its overflow
  carry to the next page. Columns are balanced on every page so partially filled regions stay
  tidy. Verses never split across pages; comments split at line boundaries (with widow/orphan
  control).

## Usage

- With the full app: `npm run dev`, then open `http://localhost:5001/print`.
- Print layouts only (faster to iterate): `npx ts-node print/cli/printServer.ts --watch`, then open
  `http://localhost:5002/print`.
- `/print/siddur?doc=<id>` and `/print/mikraot?doc=<id>`. With no `doc`, the most recently used
  document of that kind is opened. An unknown id creates a new document with that id, so
  `?doc=shabbat-pocket` is a quick way to start a variant. Open several in different tabs to
  work on variants in parallel.
- In the Siddur, click any text on a page to edit it. Scope tabs choose the level an option applies
  to (piece, segment, paragraph, section, or all); word chips are used for splits, line breaks
  and styles.
- Offline PDF: `npx ts-node print/cli/render_pdf.ts --doc print/samples/siddur-showcase.json
  --out siddur.pdf` (`--help` for options, including `--png-dir` for page images and `--offline`
  to use only cached text).
- Samples: `print/samples/*.json` (regenerate with `npx ts-node print/samples/build_samples.ts`).
  Import them with the toolbar's Import button.

## Status

Done:
- Layout engine (token rich text, line-box measurement, column packing) with unit tests.
- Mikraot Gedolot: tiers, configurable commentators/order/English, targum beside the text,
  parasha (petucha/setuma) breaks, trope toggle, English notes, commentary lag budget,
  page-fill control, all page sizes.
- Siddur: Nusach Ashkenaz (curated weekday Shacharit + Kabbalat Shabbat/Shabbat evening from
  Sefaria + Birkat Hamazon), all translation modes, splits, breaks, styles, commentary notes,
  per-level overrides, section page breaks, running heads.
- IndexedDB documents, `?doc=`, duplicate/export/import/delete; offline PDF/PNG renderer.

Next:
- Siddur facing-pages mode (Hebrew and English on facing pages, Koren style).
- Mikraot per-comment curation UI (hide/re-tier individual comments) and an import format for
  AI-produced curation.
- Nusach Sefard and Koren Machzor editions (registered, disabled until their sources are mapped).

Known issues:
- Chrome occasionally stretches letters on a justified Hebrew line; Siddur defaults are therefore
  ragged (start-aligned).
