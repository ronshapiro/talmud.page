import {numericLiteralAsInt, intToHebrewNumeral} from "../hebrew";

test("symmetry", () => {
  for (let i = 1; i <= 1000; i++) {
    expect(numericLiteralAsInt(intToHebrewNumeral(i))).toEqual(i);
  }
});

test("weird", () => {
  expect(intToHebrewNumeral(14)).toEqual("יד");
  expect(intToHebrewNumeral(15)).toEqual("טו");
  expect(intToHebrewNumeral(16)).toEqual("טז");
  expect(intToHebrewNumeral(17)).toEqual("יז");
});
