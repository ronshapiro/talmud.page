import {sefariaTextTypeTransformation, firstOrOnlyElement} from "../sefariaTextType";

const duplicate = sefariaTextTypeTransformation(x => x + x);

test("string", () => {
  expect(duplicate("ab")).toEqual("abab");
});

test("string[]", () => {
  expect(duplicate(["ab", "cd"])).toEqual(["abab", "cdcd"]);
});

test("string[][]", () => {
  // @ts-ignore
  expect(duplicate([["ab", "cd"], ["e"]])).toEqual([["abab", "cdcd"], ["ee"]]);
});

test("mixed", () => {
  // @ts-ignore
  expect(duplicate([["ab", "cd"], ["e"], "f", [[["h"]]]])).toEqual(
    [["abab", "cdcd"], ["ee"], "ff", [[["hh"]]]]);
});

test("firstOrOnlyElement - string", () => {
  expect(firstOrOnlyElement("hello")).toBe("hello");
});

test("firstOrOnlyElement - string[]", () => {
  expect(firstOrOnlyElement(["hello", "world"])).toBe("hello");
});

test("firstOrOnlyElement - string[][]", () => {
  // @ts-ignore
  expect(firstOrOnlyElement([["hello"], ["world"]])).toBe("hello");
});
