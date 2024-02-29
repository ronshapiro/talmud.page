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

  expect(intToHebrewNumeral(114)).toEqual("קיד");
  expect(intToHebrewNumeral(115)).toEqual("קטו");
  expect(intToHebrewNumeral(116)).toEqual("קטז");
  expect(intToHebrewNumeral(117)).toEqual("קיז");

  expect(intToHebrewNumeral(214)).toEqual("ריד");
  expect(intToHebrewNumeral(215)).toEqual("רטו");
  expect(intToHebrewNumeral(216)).toEqual("רטז");
  expect(intToHebrewNumeral(217)).toEqual("ריז");
});
