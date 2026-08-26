import {expandRef} from "./ref_expander";

test("a non-range ref is returned unchanged", () => {
  expect(expandRef("Zevachim 2a:1")).toEqual(["Zevachim 2a:1"]);
});

test("returns undefined for an unrecognized book", () => {
  expect(expandRef("Not A Real Book 2a:1-3")).toBeUndefined();
});

test("expands a same-page range", () => {
  expect(expandRef("Zevachim 2a:1-3")).toEqual([
    "Zevachim 2a:1",
    "Zevachim 2a:2",
    "Zevachim 2a:3",
  ]);
});

test("throws on a range endpoint that's a segmentation-override sub-ref", () => {
  expect(() => expandRef("Zevachim 2a:1-3:split:1")).toThrow(/:split:/);
});

test("throws on a range endpoint with a non-numeric trailing segment component", () => {
  expect(() => expandRef("Zevachim 2a:1-3a")).toThrow(/non-numeric trailing segment/);
});
