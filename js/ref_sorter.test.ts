// @ts-ignore
import {refSorter} from "./ref_sorter.ts";

test("same parent ref", () => {
  const refs = [
    "Book Foo 1b.1",
    "Book Foo 10a.1",
    "Book Foo 1a.1",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Book Foo 1a.1",
    "Book Foo 1b.1",
    "Book Foo 10a.1",
  ]);
});

test("tanach style", () => {
  const refs = [
    "Book Foo 1:11",
    "Book Foo 1:2",
    "Book Foo 1:1",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Book Foo 1:1",
    "Book Foo 1:2",
    "Book Foo 1:11",
  ]);
});

test("Rashi style", () => {
  const refs = [
    "Rashi on Shabbat 100b:1:10",
    "Rashi on Shabbat 99b:10:10",
    "Rashi on Shabbat 99b:1:10",
    "Rashi on Shabbat 99b:10:2",
    "Rashi on Shabbat 99b:1:2",
    "Rashi on Shabbat 99b:10:1",
    "Rashi on Shabbat 99b:1:1",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Rashi on Shabbat 99b:1:1",
    "Rashi on Shabbat 99b:1:2",
    "Rashi on Shabbat 99b:1:10",
    "Rashi on Shabbat 99b:10:1",
    "Rashi on Shabbat 99b:10:2",
    "Rashi on Shabbat 99b:10:10",
    "Rashi on Shabbat 100b:1:10",
  ]);
});
