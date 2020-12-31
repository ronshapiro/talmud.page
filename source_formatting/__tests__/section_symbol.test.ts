import {SectionSymbolRemover} from "../section_symbol";

test("only text", () => {
  expect(SectionSymbolRemover.process("§ hello world")).toBe("hello world");
});

test("only first symbol", () => {
  expect(SectionSymbolRemover.process("§ § hello world")).toBe("§ hello world");
});

test("no space", () => {
  expect(SectionSymbolRemover.process("§hello world")).toBe("hello world");
});

test("prefix", () => {
  expect(SectionSymbolRemover.process("prefix § hello world")).toBe("prefix § hello world");
});

test("tag prefix", () => {
  expect(SectionSymbolRemover.process("<b>prefix</b> § hello world"))
    .toBe("<b>prefix</b> § hello world");
});

test("inside tag", () => {
  expect(SectionSymbolRemover.process("<b><i></i>§ hello</b> world"))
    .toBe("<b><i></i>hello</b> world");
});

test("inside tag no space", () => {
  expect(SectionSymbolRemover.process("<b><i>§</i> hello</b> world"))
    .toBe("<b><i></i> hello</b> world");
});
