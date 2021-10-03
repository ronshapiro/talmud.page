import {SIDDUR_REF_REWRITING} from "../siddur";
import {SIDDUR_SECTIONS} from "../js/siddur";

test("Section names in sync", () => {
  expect(SIDDUR_SECTIONS).toEqual(Object.keys(SIDDUR_REF_REWRITING));
});
