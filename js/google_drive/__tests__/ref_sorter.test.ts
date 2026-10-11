import {refSorter} from "../ref_sorter";

// Coverage for the ":split:<N>" ref shape used by the segmentation-override feature
// (precomputed/segmentation_overrides.ts) — synthetic sub-refs like
// "Avodah Zarah 65a:10:split:1" have more ":"-separated pieces than a plain ref, which changes
// the length of the array refPieces() builds for them. Before this coverage existed, that length
// mismatch fell back to naive array-to-string lexicographic comparison, which is wrong once a
// double-digit segment is involved: comparing "...9" (ends there) against "...10:split:1"
// (continues) compared "9" against "10" as strings, and "9" > "10" lexicographically even though
// 9 < 10 numerically — segment 9 would have sorted after segment 10's split pieces.

test("same parent ref", () => {
  const refs = [
    "Book Foo 1b:1",
    "Book Foo 10a:1",
    "Book Foo 1a:1",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Book Foo 1a:1",
    "Book Foo 1b:1",
    "Book Foo 10a:1",
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
    "Rashi on Shabbat 99b:2:10",
    "Rashi on Shabbat 99b:10:2",
    "Rashi on Shabbat 99b:1:2",
    "Rashi on Shabbat 99b:10:1",
    "Rashi on Shabbat 99b:1:1",
    "Rashi on Shabbat 99a:2:10",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Rashi on Shabbat 99a:2:10",
    "Rashi on Shabbat 99b:1:1",
    "Rashi on Shabbat 99b:1:2",
    "Rashi on Shabbat 99b:1:10",
    "Rashi on Shabbat 99b:2:10",
    "Rashi on Shabbat 99b:10:1",
    "Rashi on Shabbat 99b:10:2",
    "Rashi on Shabbat 99b:10:10",
    "Rashi on Shabbat 100b:1:10",
  ]);
});

test("split-suffixed refs sort in order relative to each other", () => {
  const refs = [
    "Book Foo 2a:10:split:2",
    "Book Foo 2a:10:split:1",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Book Foo 2a:10:split:1",
    "Book Foo 2a:10:split:2",
  ]);
});

test("a single-digit segment sorts before a later double-digit segment's split pieces", () => {
  const refs = [
    "Book Foo 2a:10:split:2",
    "Book Foo 2a:11",
    "Book Foo 2a:9",
    "Book Foo 2a:10:split:1",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Book Foo 2a:9",
    "Book Foo 2a:10:split:1",
    "Book Foo 2a:10:split:2",
    "Book Foo 2a:11",
  ]);
});

test("an original ref sorts before its own split pieces", () => {
  const refs = [
    "Book Foo 2a:10:split:1",
    "Book Foo 2a:10",
  ];
  refs.sort(refSorter);
  expect(refs).toEqual([
    "Book Foo 2a:10",
    "Book Foo 2a:10:split:1",
  ]);
});

test("Talmud page refs without colons sort in Talmud page order", () => {
  const references = [
    "Bava Kamma 10a",
    "Bava Kamma 2a",
    "Bava Kamma 2b",
    "Bava Kamma 9b",
    "Bava Kamma 100a",
    "Bava Kamma 99b",
    "Bava Kamma 10b",
  ];
  references.sort(refSorter);
  expect(references).toEqual([
    "Bava Kamma 2a",
    "Bava Kamma 2b",
    "Bava Kamma 9b",
    "Bava Kamma 10a",
    "Bava Kamma 10b",
    "Bava Kamma 99b",
    "Bava Kamma 100a",
  ]);
});

test("Tanakh chapter refs without colons sort numerically", () => {
  const references = [
    "Genesis 10",
    "Genesis 2",
    "Genesis 1",
  ];
  references.sort(refSorter);
  expect(references).toEqual([
    "Genesis 1",
    "Genesis 2",
    "Genesis 10",
  ]);
});

test("Talmud page ranges sort in Talmud page order", () => {
  const references = [
    "Bava Kamma 10a-15b",
    "Bava Kamma 2a-10a",
    "Bava Kamma 2a-9b",
    "Bava Kamma 2a",
    "Bava Kamma 2b",
  ];
  references.sort(refSorter);
  expect(references).toEqual([
    "Bava Kamma 2a",
    "Bava Kamma 2a-9b",
    "Bava Kamma 2a-10a",
    "Bava Kamma 2b",
    "Bava Kamma 10a-15b",
  ]);
});
