import {MikraotChapter} from "../model/dataTypes";
import {defaultMikraotDocument} from "../model/documents";
import {applyCuration, buildCurationRequest, setCommentOverride} from "../model/curation";

const CHAPTER: MikraotChapter = {
  book: "Genesis",
  bookHebrew: "בראשית",
  chapter: 1,
  verses: [{he: "בראשית", en: "In the beginning"}],
  heVersion: "",
  enVersion: "",
  commentaries: {
    rashi: {id: "rashi", verses: [[{ref: "Rashi on Genesis 1:1:1", he: "<b>בראשית.</b> אמר", en: "IN"}]]},
  },
};

describe("curation", () => {
  test("request lists every comment with its current tier", () => {
    const doc = defaultMikraotDocument();
    const request = buildCurationRequest(doc, doc.sections[0], [CHAPTER]);
    expect(request.comments).toEqual([{
      ref: "Rashi on Genesis 1:1:1",
      commentator: "rashi",
      verse: "1:1",
      hebrew: "בראשית. אמר",
      english: "IN",
      currentTier: 1,
      hidden: false,
    }]);
  });

  test("applies commentator and comment decisions, with warnings for bad input", () => {
    const {doc, warnings} = applyCuration(defaultMikraotDocument(), 0, {
      version: 1,
      kind: "mikraot-curation",
      commentators: {ramban: {tier: 2}, nobody: {tier: 1}},
      comments: {"Rashi on Genesis 1:1:1": {hidden: true}, "Rashi on Genesis 1:2:1": {tier: 7 as any}},
    });
    expect(doc.sections[0].commentators.find(x => x.id === "ramban")!.tier).toBe(2);
    expect(doc.commentOverrides["Rashi on Genesis 1:1:1"]).toEqual({hidden: true});
    expect(warnings).toEqual(["Unknown commentator: nobody", "Invalid tier for Rashi on Genesis 1:2:1: 7"]);
  });

  test("rejects other files", () => {
    expect(() => applyCuration(defaultMikraotDocument(), 0, {kind: "x"} as any)).toThrow();
  });

  test("setCommentOverride removes empty overrides", () => {
    let doc = setCommentOverride(defaultMikraotDocument(), "r", {hidden: true});
    expect(doc.commentOverrides.r).toEqual({hidden: true});
    doc = setCommentOverride(doc, "r", {hidden: undefined});
    expect(doc.commentOverrides.r).toBeUndefined();
  });
});
