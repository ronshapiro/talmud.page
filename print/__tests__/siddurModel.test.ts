import {SiddurSectionData} from "../model/dataTypes";
import {defaultSiddurDocument} from "../model/documents";
import {renderTokens, tokenize} from "../model/richText";
import {
  SiddurRow,
  automaticBreaks,
  buildSiddurUnits,
  resolveOptions,
} from "../model/siddurModel";
import {addStyle, setLayoutAt, toggleBreak, toggleSplit} from "../model/siddurEdits";


const SECTION: SiddurSectionData = {
  id: "s",
  title: "Section",
  titleHebrew: "סדר",
  segments: [
    {ref: "s 1", he: "אחד שנים שלשה ארבעה", en: "one two three four", paragraphStart: true},
    {ref: "s 2", he: "<small>הוראה</small> חמש שש", en: "<i>Instruction</i> five six"},
    {ref: "s 3", he: "שבע. שמונה, תשע", en: "seven eight nine", paragraphStart: true},
  ],
};

function build(doc = defaultSiddurDocument()) {
  doc.sections = ["s"];
  return buildSiddurUnits(doc, new Map([["s", SECTION]]));
}

function rows(doc = defaultSiddurDocument()): SiddurRow[] {
  return build(doc).units.filter((x): x is SiddurRow => x.kind === "row");
}

function text(tokens: SiddurRow["he"]): string {
  return renderTokens(tokens).replace(/<[^>]+>/g, "");
}

describe("siddur model", () => {
  test("resolves options from the most specific level", () => {
    const options = resolveOptions([{translation: "stacked", align: "center"}, {align: "end"}]);
    expect(options.translation).toBe("stacked");
    expect(options.align).toBe("end");
    expect(options.lineMode).toBe("prose");
  });

  test("prose paragraphs join segments, but a rubric starts a new row", () => {
    const result = rows();
    expect(result.map(x => text(x.he))).toEqual([
      "אחד שנים שלשה ארבעה",
      "הוראה חמש שש",
      "שבע. שמונה, תשע",
    ]);
    expect(result.map(x => x.paragraphStart)).toEqual([true, false, true]);
  });

  test("splits create pieces; lines mode gives each piece its own row", () => {
    let doc = defaultSiddurDocument();
    doc = toggleSplit(doc, "s 1", 2);
    doc = setLayoutAt(doc, {ref: "s 1", pieceIndex: 0, sectionId: "s", paragraphKey: "s#0"}, "segment", {
      lineMode: "lines",
    });
    const result = rows(doc);
    expect(text(result[0].he)).toBe("אחד שנים");
    expect(text(result[1].he)).toBe("שלשה ארבעה");
    // English split proportionally.
    expect(text(result[0].en)).toBe("one two");
    expect(text(result[1].en)).toBe("three four");
  });

  test("toggleSplit twice removes the split", () => {
    const doc = toggleSplit(toggleSplit(defaultSiddurDocument(), "s 1", 2), "s 1", 2);
    expect(doc.segmentOverrides["s 1"]).toBeUndefined();
  });

  test("line breaks and styles", () => {
    let doc = defaultSiddurDocument();
    doc = toggleBreak(doc, "s 1", "he", 2);
    doc = addStyle(doc, "s 1", "he", 0, 1, {bold: true});
    const html = renderTokens(rows(doc)[0].he);
    expect(html).toContain("<br>");
    expect(html).toContain('style="font-weight: bold"');
  });

  test("footnote mode moves English to notes with markers", () => {
    const doc = defaultSiddurDocument();
    doc.defaults = {...doc.defaults, translation: "footnote"};
    const result = rows(doc);
    expect(result[0].en).toEqual([]);
    expect(result[0].notes.map(x => [x.marker, x.html])).toEqual([["1", "one two three four"]]);
    expect(renderTokens(result[0].he)).toContain('<sup class="sd-fn">1</sup>');
  });

  test("hidden pieces are dropped", () => {
    const doc = defaultSiddurDocument();
    doc.segmentOverrides["s 2"] = {hidden: true};
    expect(rows(doc).map(x => text(x.he))).toEqual(["אחד שנים שלשה ארבעה", "שבע. שמונה, תשע"]);
  });

  test("automatic breaks", () => {
    const tokens = tokenize("שבע. שמונה, תשע");
    expect(automaticBreaks(tokens, "sentence")).toEqual([1]);
    expect(automaticBreaks(tokens, "clause")).toEqual([1, 2]);
    expect(automaticBreaks(tokens, "none")).toEqual([]);
  });

  test("commentary notes are attached when enabled", () => {
    const doc = defaultSiddurDocument();
    doc.commentary["s 3"] = [{type: "Koren Sacks Commentary", html: "A note"}];
    expect(rows(doc)[2].notes.map(x => x.html)).toEqual(["A note"]);
    doc.showCommentary = [];
    expect(rows(doc)[2].notes).toEqual([]);
  });
});

describe("splitting at source lines", () => {
  const section: SiddurSectionData = {
    id: "k",
    title: "K",
    titleHebrew: "ק",
    segments: [
      {ref: "k 1", he: "א ב<br>ג ד<br>ה ו", en: "a b<br>c d<br>e f", paragraphStart: true},
      {ref: "k 2", he: "א ב<br>ג ד<br>ה ו", en: "a b c<br>d e f g h", paragraphStart: true},
    ],
  };
  const build2 = () => {
    const doc = defaultSiddurDocument();
    doc.sections = ["k"];
    doc.defaults = {...doc.defaults, lineMode: "lines", splitLines: true};
    return buildSiddurUnits(doc, new Map([["k", section]])).units
      .filter((x): x is SiddurRow => x.kind === "row")
      .map(x => [text(x.he), text(x.en)]);
  };

  test("pairs Hebrew and English lines when the counts match, else snaps to English lines", () => {
    expect(build2()).toEqual([
      ["א ב", "a b"], ["ג ד", "c d"], ["ה ו", "e f"],
      ["א ב", "a b c"], ["ג ד", ""], ["ה ו", "d e f g h"],
    ]);
  });
});
