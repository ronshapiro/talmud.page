/* eslint-disable no-console */
// Generates the sample documents in print/samples/*.json. They double as demos (import them in the
// browser) and as inputs to the offline renderer:
//
//   npx ts-node print/samples/build_samples.ts
//   npx ts-node print/cli/render_pdf.ts --doc print/samples/siddur-showcase.json --out out.pdf

import * as fs from "fs";
import * as path from "path";
import {
  MikraotDocument,
  SegmentOverride,
  SiddurDocument,
  defaultMikraotDocument,
  defaultSiddurDocument,
} from "../model/documents";
import {tokenize, tokensText} from "../model/richText";
import {siddurSectionData} from "../server/printData";

const OUT = __dirname;

const SHEMA = "SiddurAshkenaz/Birchot Kriat Shema";
const LEKHA_DODI = "Siddur Ashkenaz, Shabbat, Kabbalat Shabbat, Lekha Dodi";
const SHEMA_PREFIX = "Siddur Ashkenaz, Weekday, Shacharit, Blessings of the Shema, ";

function write(name: string, doc: unknown) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(doc, undefined, 2) + "\n");
  console.log(`Wrote ${name}`);
}

/** Token index of the first token whose text starts with `word` (after `after`). */
function wordIndex(html: string, word: string, after = 0): number {
  // Compare consonants only: vowel/cantillation mark order varies between sources.
  const bare = (text: string) => text.replace(/<[^>]+>/g, "").replace(/[\u0591-\u05C7]/g, "");
  const tokens = tokenize(html);
  for (let i = after; i < tokens.length; i++) {
    if (bare(tokensText(tokens, i, i + 1)).startsWith(bare(word))) return i;
  }
  throw new Error(`"${word}" not found in ${tokensText(tokens)}`);
}

async function siddurShowcase(): Promise<SiddurDocument> {
  const shema = await siddurSectionData("ashkenaz", SHEMA);
  const lekhaDodi = await siddurSectionData("ashkenaz", LEKHA_DODI);
  const segment = (suffix: string) => {
    const found = shema.segments.find(x => x.ref === SHEMA_PREFIX + suffix);
    if (!found) throw new Error(suffix);
    return found;
  };

  const doc = defaultSiddurDocument("Showcase: Koren-style siddur");
  doc.id = "siddur-showcase";
  doc.sections = [SHEMA, LEKHA_DODI];

  const overrides: Record<string, SegmentOverride> = {};

  // Barchu: call and response, centered on their own lines, a little larger.
  doc.paragraphOverrides[`${SHEMA}#0`] = {lineMode: "lines", align: "center", englishAlign: "center"};
  overrides[segment("Barchu 2-3").ref] = {scale: 1.12};

  // "Yotzer or": split the blessing into sense lines.
  const yotzer = segment("First Blessing before Shema 1");
  overrides[yotzer.ref] = {
    splitHe: [wordIndex(yotzer.he, "יוֹצֵר"), wordIndex(yotzer.he, "עֹשֶׂה")],
    splitEn: [
      wordIndex(yotzer.en, "Former"),
      wordIndex(yotzer.en, "Maker"),
    ],
  };

  // Kedusha verses: stacked, centered, with the "kadosh" words emphasized.
  const kadosh = segment("First Blessing before Shema 5");
  overrides[kadosh.ref] = {
    translation: "stacked",
    align: "center",
    englishAlign: "center",
    spaceBefore: 0.6,
    keepWithNext: false,
    stylesHe: [{start: 0, end: 3, style: {scale: 1.3, letterSpacing: 0.04, color: "#7a1f1f"}}],
  };
  overrides[segment("First Blessing before Shema 7").ref] = {
    translation: "stacked",
    align: "center",
    englishAlign: "center",
    spaceBefore: 0.6,
    scale: 1.15,
  };

  // Shema Yisrael: stacked and centered, larger.
  doc.paragraphOverrides[`${SHEMA}#3`] = {translation: "stacked", align: "center", englishAlign: "center"};
  overrides[segment("Shema 3").ref] = {scale: 1.15, spaceBefore: 0.8};

  // Ve'ahavta: Hebrew only, with the English as footnotes; a verse per line.
  doc.paragraphOverrides[`${SHEMA}#4`] = {translation: "footnote", lineMode: "lines", indent: 1.5};
  // Vehaya: a verse per line, side by side.
  doc.paragraphOverrides[`${SHEMA}#5`] = {lineMode: "lines", indent: 1.5};

  doc.commentary[segment("Barchu 2-3").ref] = [{
    type: "Koren Sacks Commentary",
    html: "<i>[Sample.]</i> Commentary notes are entered per segment in the editor and set at the "
      + "foot of the page, separately from the translation footnotes.",
  }];

  // Lekha Dodi: stanzas as centered sense lines (one line per clause), refrain abbreviated.
  doc.sectionOverrides[LEKHA_DODI] = {hebrewBreaks: "sentence", align: "center"};
  lekhaDodi.segments.forEach((x, i) => {
    if (i === 0) {
      // The first refrain in full, as a heading-like line; its English (with the long
      // introduction) becomes a footnote.
      overrides[x.ref] = {
        translation: "footnote",
        heOverride: x.he.replace(/<\/?small>/g, ""),
        stylesHe: [{start: 0, end: tokenize(x.he).length, style: {bold: true, scale: 1.1}}],
      };
    } else if (i % 2 === 0) {
      // Later refrains: Hebrew only, keeping the source's small "abbreviated refrain" styling.
      overrides[x.ref] = {translation: "hebrew-only", spaceBefore: 0.3};
    }
  });
  // Demonstrate a split inside a stanza: the second stanza's last line becomes its own piece.
  const stanza = lekhaDodi.segments[3];
  overrides[stanza.ref] = {
    ...(overrides[stanza.ref] ?? {}),
    splitHe: [wordIndex(stanza.he, "סוֹף")],
    pieces: {1: {css: "color: #7a1f1f"}},
  };

  doc.segmentOverrides = overrides;
  return doc;
}

function siddurHebrewOnly(): SiddurDocument {
  const doc = defaultSiddurDocument("Hebrew-only pocket siddur");
  doc.id = "siddur-hebrew-only-pocket";
  doc.page = {...doc.page,
    preset: "pocket",
    unit: "in",
    width: 4.25,
    height: 6.875,
    margins: {top: 0.5, bottom: 0.55, inner: 0.55, outer: 0.45}};
  doc.sections = [SHEMA, LEKHA_DODI];
  doc.defaults = {translation: "hebrew-only", lineMode: "prose", align: "justify"};
  doc.sectionOverrides[LEKHA_DODI] = {hebrewBreaks: "sentence", align: "center"};
  doc.typography = {...doc.typography, hebrewSizePt: 13};
  return doc;
}

function mikraotGenesis(): MikraotDocument {
  const doc = defaultMikraotDocument("Genesis 1 (default)");
  doc.id = "mikraot-genesis-1";
  return doc;
}

function mikraotExodus(): MikraotDocument {
  const doc = defaultMikraotDocument("Exodus 20 with Onkelos", "Exodus");
  doc.id = "mikraot-exodus-20";
  doc.startChapter = 20;
  doc.endChapter = 20;
  doc.layout = {...doc.layout, showTargum: true};
  doc.commentators = doc.commentators.map(x => {
    if (x.id === "ibn-ezra") return {...x, tier: 1 as const, showEnglish: true};
    if (x.id === "or-hachaim") return {...x, tier: 2 as const};
    return x;
  });
  return doc;
}

function mikraotIsaiah(): MikraotDocument {
  const doc = defaultMikraotDocument("Isaiah 40, A4", "Isaiah");
  doc.id = "mikraot-isaiah-40";
  doc.startChapter = 40;
  doc.endChapter = 40;
  doc.page = {...doc.page,
    preset: "a4",
    unit: "mm",
    width: 210,
    height: 297,
    margins: {top: 16, bottom: 16, inner: 18, outer: 14}};
  doc.typography = {...doc.typography, showTrope: false};
  doc.layout = {...doc.layout, notesColumns: 3, tier2Columns: 3};
  return doc;
}

(async () => {
  write("siddur-showcase.json", await siddurShowcase());
  write("siddur-hebrew-only-pocket.json", siddurHebrewOnly());
  write("mikraot-genesis-1.json", mikraotGenesis());
  write("mikraot-exodus-20.json", mikraotExodus());
  write("mikraot-isaiah-40.json", mikraotIsaiah());
})();
