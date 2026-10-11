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

test("Merge Talmud page refs in strict Talmud page order across double-digit dafs", () => {
  const result = Array.from(
    mergeRefs([
      "Bava Kamma 10a",
      "Bava Kamma 2a",
      "Bava Kamma 9b",
    ]).keys());
  expect(result).toEqual(["Bava Kamma 2a-10a"]);
});

test("Merge Talmud page refs without 10a", () => {
  const result = Array.from(
    mergeRefs([
      "Bava Kamma 2a",
      "Bava Kamma 9b",
    ]).keys());
  expect(result).toEqual(["Bava Kamma 2a-9b"]);
});

test("Merge multiple tractates with double-digit dafs sorting keys in Talmud page order", () => {
  const result = Array.from(
    mergeRefs([
      "Berakhot 10a",
      "Berakhot 2a",
      "Bava Kamma 10a",
      "Bava Kamma 2a",
    ]).keys());
  expect(result).toEqual(["Bava Kamma 2a-10a", "Berakhot 2a-10a"]);
});
