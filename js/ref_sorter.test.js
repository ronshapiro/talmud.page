const {refSorter} = require("./ref_sorter.js");

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
