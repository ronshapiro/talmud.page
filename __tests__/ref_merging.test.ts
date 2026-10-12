import {mergeRefs} from "../ref_merging";

test("Merge weird refs", () => {
  const result = Array.from(
    mergeRefs([
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 2",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 3"]).keys());
  expect(result).toEqual(["Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 2-3"]);
});


test("Merge identical", () => {
  const result = Array.from(
    mergeRefs([
      "Genesis 1:1",
      "Genesis 1:1"]).keys());
  expect(result).toEqual(["Genesis 1:1"]);
});

test("Merge identical with others", () => {
  const result = Array.from(
    mergeRefs([
      "Genesis 1:1",
      "Genesis 1:2",
      "Genesis 1:1",
      "Genesis 1:2"]).keys());
  expect(result).toEqual(["Genesis 1:1-2"]);
});

test("Merge contiguous Talmud page refs in strict Talmud page order across double-digit dafs", () => {
  const result = Array.from(
    mergeRefs([
      "Bava Kamma 2a",
      "Bava Kamma 2b",
      "Bava Kamma 3a",
    ]).keys());
  expect(result).toEqual(["Bava Kamma 2a-3a"]);
});

test("Breaks non-contiguous Talmud page refs into separate ranges", () => {
  const result = Array.from(
    mergeRefs([
      "Bava Kamma 2a",
      "Bava Kamma 9a",
      "Bava Kamma 9b",
      "Bava Kamma 10a",
      "Bava Kamma 10b",
    ]).keys());
  expect(result).toEqual(["Bava Kamma 2a", "Bava Kamma 9a-10b"]);
});

test("Breaks bare amud list into separate ranges when non-contiguous", () => {
  const result = Array.from(
    mergeRefs([
      "2a",
      "9a",
      "9b",
      "10a",
      "10b",
    ]).keys());
  expect(result).toEqual(["2a", "9a-10b"]);
});

test("Does not merge non-contiguous numeric verses when requireContiguity is true", () => {
  const result = Array.from(
    mergeRefs([
      "Genesis 1:1",
      "Genesis 1:5",
    ], {requireContiguity: true}).keys());
  expect(result).toEqual(["Genesis 1:1", "Genesis 1:5"]);
});

test("Merges non-contiguous numeric verses by default for API query batching", () => {
  const result = Array.from(
    mergeRefs([
      "Genesis 1:1",
      "Genesis 1:5",
    ]).keys());
  expect(result).toEqual(["Genesis 1:1-5"]);
});

test("Merge multiple tractates with contiguous runs", () => {
  const result = Array.from(
    mergeRefs([
      "Berakhot 2a",
      "Berakhot 2b",
      "Bava Kamma 2a",
      "Bava Kamma 2b",
    ]).keys());
  expect(result).toEqual(["Bava Kamma 2a-2b", "Berakhot 2a-2b"]);
});
