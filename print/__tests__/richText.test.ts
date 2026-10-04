import {
  applyLineBreaks,
  applyStyleRanges,
  renderTokens,
  sanitizeCss,
  splitTokens,
  tokenize,
  tokensText,
  wordStarts,
} from "../model/richText";

describe("tokenize/renderTokens", () => {
  test("round trips plain text", () => {
    expect(renderTokens(tokenize("hello  world"))).toBe("hello world");
  });

  test("round trips nested markup", () => {
    const html = "<small>ואומר:</small> <span class=\"big\"><b>בָּרְכוּ אֶת</b> יְהֹוָה</span>";
    const tokens = tokenize(html);
    expect(tokens.map(x => x.html)).toEqual(["ואומר:", "בָּרְכוּ", "אֶת", "יְהֹוָה"]);
    expect(tokens[1].marks.map(x => x.tag)).toEqual(["span", "b"]);
    expect(renderTokens(tokens)).toBe(html);
  });

  test("keeps mid-word markup as sub-tokens without spaces", () => {
    const tokens = tokenize("<big>בְּ</big>רֵאשִׁ֖ית בָּרָ֣א");
    expect(tokens.map(x => x.html)).toEqual(["בְּ", "רֵאשִׁ֖ית", "בָּרָ֣א"]);
    expect(tokens[0].spaceAfter).toBe(false);
    expect(wordStarts(tokens)).toEqual([0, 2]);
    expect(renderTokens(tokens)).toBe("<big>בְּ</big>רֵאשִׁ֖ית בָּרָ֣א");
  });

  test("slices close and reopen marks", () => {
    const tokens = tokenize("<b>one two three</b> four");
    expect(renderTokens(tokens, {start: 1, end: 3})).toBe("<b>two three</b>");
    expect(renderTokens(tokens, {start: 2})).toBe("<b>three</b> four");
  });

  test("br tokens", () => {
    const tokens = tokenize("a<br>b <br/> c");
    expect(tokens.map(x => x.kind)).toEqual(["word", "br", "word", "br", "word"]);
    expect(renderTokens(tokens)).toBe("a<br>b<br>c");
  });

  test("drops scripts and images", () => {
    expect(renderTokens(tokenize("a<script>alert(1)</script> <img src=x> b"))).toBe("a b");
  });

  test("wraps words", () => {
    const html = renderTokens(tokenize("<i>a b</i>"), {wrapWord: (h, i) => `<s data-t="${i}">${h}</s>`});
    expect(html).toBe('<i><s data-t="0">a</s> <s data-t="1">b</s></i>');
  });

  test("tokensText", () => {
    expect(tokensText(tokenize("<b>a</b> b<br>c"))).toBe("a b\nc");
  });
});

describe("editing transforms", () => {
  test("style ranges become innermost spans", () => {
    const tokens = applyStyleRanges(tokenize("<b>a b</b> c"), [
      {start: 1, end: 3, style: {scale: 1.5, color: "#a00"}},
    ]);
    expect(renderTokens(tokens)).toBe(
      '<b>a <span class="ps-style" style="font-size: 1.5em; color: #a00">b</span></b>'
        + ' <span class="ps-style" style="font-size: 1.5em; color: #a00">c</span>');
  });

  test("line breaks", () => {
    expect(renderTokens(applyLineBreaks(tokenize("a b c"), [2]))).toBe("a b<br>c");
  });

  test("split tokens", () => {
    const pieces = splitTokens(tokenize("a b c d"), [1, 3, 3, 99]);
    expect(pieces.map(x => renderTokens(x))).toEqual(["a", "b c", "d"]);
  });

  test("sanitizeCss", () => {
    expect(sanitizeCss("color: red; background: url(x); font-size:2em;}")).toBe(
      "color: red; font-size: 2em");
    expect(sanitizeCss('color: red" onload="x')).toBe("");
  });
});
