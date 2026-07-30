import {mergeCommentaries} from "../mergeCommentaries";
import {commentaries, resetFixtureCounter, segment} from "./testing/fixtures";

beforeEach(resetFixtureCounter);

test("returns undefined when no section has commentary", () => {
  expect(mergeCommentaries([segment(), segment()])).toBeUndefined();
});

test("returns the commentary of a single section unchanged", () => {
  const merged = mergeCommentaries([
    segment({commentary: commentaries({Rashi: [{ref: "r1"}]})}),
  ])!;

  expect(Object.keys(merged)).toEqual(["Rashi"]);
  expect(merged.Rashi.comments.map(x => x.ref)).toEqual(["r1"]);
});

test("concatenates comments of the same commentary across sections", () => {
  const merged = mergeCommentaries([
    segment({commentary: commentaries({Rashi: [{ref: "r1"}]})}),
    segment({commentary: commentaries({Rashi: [{ref: "r2"}, {ref: "r3"}]})}),
  ])!;

  expect(merged.Rashi.comments.map(x => x.ref)).toEqual(["r1", "r2", "r3"]);
});

test("unions commentaries that appear in only some sections", () => {
  const merged = mergeCommentaries([
    segment({commentary: commentaries({Rashi: [{ref: "r1"}]})}),
    segment(),
    segment({commentary: commentaries({Tosafot: [{ref: "t1"}]})}),
  ])!;

  expect(Object.keys(merged).sort()).toEqual(["Rashi", "Tosafot"]);
  expect(merged.Tosafot.comments.map(x => x.ref)).toEqual(["t1"]);
});

describe("Translation and Steinsaltz are collapsed into one comment", () => {
  for (const key of ["Translation", "Steinsaltz"]) {
    test(`${key} texts are joined with spaces`, () => {
      const merged = mergeCommentaries([
        segment({commentary: commentaries({[key]: [{ref: "a", he: "אחד", en: "one"}]})}),
        segment({commentary: commentaries({[key]: [{ref: "b", he: "שתים", en: "two"}]})}),
      ])!;

      expect(merged[key].comments).toHaveLength(1);
      expect(merged[key].comments[0].he).toBe("אחד שתים");
      expect(merged[key].comments[0].en).toBe("one two");
    });

    test(`${key} keeps the metadata of the first comment`, () => {
      const merged = mergeCommentaries([
        segment({commentary: commentaries({[key]: [{ref: "a", sourceRef: "first"}]})}),
        segment({commentary: commentaries({[key]: [{ref: "b", sourceRef: "second"}]})}),
      ])!;

      expect(merged[key].comments[0].ref).toBe("a");
      expect(merged[key].comments[0].sourceRef).toBe("first");
    });

    test(`${key} skips empty sides so no stray separators appear`, () => {
      const merged = mergeCommentaries([
        segment({commentary: commentaries({[key]: [{ref: "a", he: "אחד", en: ""}]})}),
        segment({commentary: commentaries({[key]: [{ref: "b", he: "", en: "two"}]})}),
        segment({commentary: commentaries({[key]: [{ref: "c", he: "שלוש", en: "three"}]})}),
      ])!;

      expect(merged[key].comments[0].he).toBe("אחד שלוש");
      expect(merged[key].comments[0].en).toBe("two three");
    });
  }
});

test("other commentaries are not collapsed", () => {
  const merged = mergeCommentaries([
    segment({commentary: commentaries({Rashi: [{ref: "a", he: "אחד"}]})}),
    segment({commentary: commentaries({Rashi: [{ref: "b", he: "שתים"}]})}),
  ])!;

  expect(merged.Rashi.comments).toHaveLength(2);
});

test("does not mutate the input sections", () => {
  const first = segment({commentary: commentaries({Rashi: [{ref: "r1"}]})});
  const second = segment({commentary: commentaries({Rashi: [{ref: "r2"}]})});

  mergeCommentaries([first, second]);

  expect(first.commentary!.Rashi.comments.map(x => x.ref)).toEqual(["r1"]);
  expect(second.commentary!.Rashi.comments.map(x => x.ref)).toEqual(["r2"]);
});
