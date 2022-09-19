import {
  BIRKAT_HAMAZON_REFS,
  SIDDUR_REFS_ASHKENAZ,
  SIDDUR_REFS_SEFARD,
} from "../siddur";
import {
  BIRKAT_HAMAZON_SECTIONS,
  SIDDUR_ASHKENAZ_SECTIONS,
  SIDDUR_SEFARD_SECTIONS,
} from "../js/siddur";

test("[Ashkenaz] Section names in sync", () => {
  expect(SIDDUR_ASHKENAZ_SECTIONS).toEqual(Object.keys(SIDDUR_REFS_ASHKENAZ));
});

test("[Sefard] Section names in sync", () => {
  expect(SIDDUR_SEFARD_SECTIONS).toEqual(Object.keys(SIDDUR_REFS_SEFARD));
});

test("[birkat hamazon] Section names in sync", () => {
  expect(BIRKAT_HAMAZON_SECTIONS).toEqual(Object.keys(BIRKAT_HAMAZON_REFS));
});
