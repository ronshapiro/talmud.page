import {mergeRefs} from "../ref_merging";

test("Merge weird refs", () => {
  const result = Array.from(
    mergeRefs([
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 2",
      "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 3"]).keys());
  expect(result).toEqual(["Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 2-3"]);
});
