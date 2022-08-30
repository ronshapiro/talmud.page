import {BIRKAT_HAMAZON_REFS, SIDDUR_REF_REWRITING} from "../siddur";
import {BIRKAT_HAMAZON_SECTIONS, SIDDUR_SECTIONS} from "../js/siddur";

test("[Ashkenaz] Section names in sync", () => {
  expect(SIDDUR_SECTIONS).toEqual(Object.keys(SIDDUR_REF_REWRITING));
});

test("[birkat hamazon] Section names in sync", () => {
  expect(BIRKAT_HAMAZON_SECTIONS).toEqual(Object.keys(BIRKAT_HAMAZON_REFS));
});
