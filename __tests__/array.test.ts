import {surroundingContext} from "../arrays";

test("context: zero", () => {
  const zero = () => surroundingContext(["a"], "a", 0);
  expect(zero).toThrow();
});

test("context: negative", () => {
  const negative = () => surroundingContext(["a"], "a", -1);
  expect(negative).toThrow();
});

test("single", () => {
  expect(surroundingContext(["a"], "a", 1)).toEqual(["a"]);
  expect(surroundingContext(["a"], "a", 10)).toEqual(["a"]);
});


test("first", () => {
  expect(surroundingContext([10, 11, 12], 10, 1)).toEqual([10, 11]);
  expect(surroundingContext([10, 11, 12], 10, 2)).toEqual([10, 11, 12]);
  expect(surroundingContext([10, 11, 12], 10, 3)).toEqual([10, 11, 12]);
});


test("middle", () => {
  expect(surroundingContext([10, 11, 12], 11, 1)).toEqual([10, 11, 12]);
  expect(surroundingContext([10, 11, 12], 11, 2)).toEqual([10, 11, 12]);
  expect(surroundingContext([10, 11, 12], 11, 3)).toEqual([10, 11, 12]);
});

test("last", () => {
  expect(surroundingContext([10, 11, 12], 12, 1)).toEqual([11, 12]);
  expect(surroundingContext([10, 11, 12], 12, 2)).toEqual([10, 11, 12]);
  expect(surroundingContext([10, 11, 12], 12, 3)).toEqual([10, 11, 12]);
});
