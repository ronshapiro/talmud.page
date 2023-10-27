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
