import {Commentary} from "../../apiTypes";
import {DriveClient} from "../google_drive/client";
import {HighlightCommentWithText} from "../google_drive/types";
import {findReplacedRefsWithPersonalContent} from "../checkReplacedRefs";
import {UiPage} from "../Page";

function amud(overrides: Partial<UiPage> = {}): UiPage {
  return {
    id: "2a", title: "Test 2a", titleHebrew: "בדיקה ב.", sections: [], ...overrides,
  } as UiPage;
}

function fakeDriveClient(overrides: Partial<DriveClient> = {}): DriveClient {
  return {
    commentsForRef: () => undefined,
    highlightsForRef: () => [],
    ...overrides,
  } as DriveClient;
}

test("returns an empty array when there are no replacedRefs", () => {
  const result = findReplacedRefsWithPersonalContent(amud(), fakeDriveClient());
  expect(result).toEqual([]);
});

test("excludes a replaced ref with no personal comments or highlights", () => {
  const result = findReplacedRefsWithPersonalContent(
    amud({replacedRefs: ["Test 2a:1"]}), fakeDriveClient());
  expect(result).toEqual([]);
});

test("includes a replaced ref with a personal comment", () => {
  const commentary: Commentary = {comments: [{ref: "Test 2a:1", he: "", en: "note"} as any]};
  const result = findReplacedRefsWithPersonalContent(
    amud({replacedRefs: ["Test 2a:1"]}),
    fakeDriveClient({commentsForRef: ref => (ref === "Test 2a:1" ? commentary : undefined)}));
  expect(result).toEqual(["Test 2a:1"]);
});

test("includes a replaced ref with a highlight", () => {
  const result = findReplacedRefsWithPersonalContent(
    amud({replacedRefs: ["Test 2a:1"]}),
    fakeDriveClient({
      highlightsForRef: ref => (ref === "Test 2a:1" ? [{} as HighlightCommentWithText] : []),
    }));
  expect(result).toEqual(["Test 2a:1"]);
});

test("only returns the replaced refs that actually have personal content", () => {
  const commentary: Commentary = {comments: [{ref: "Test 2a:2", he: "", en: "note"} as any]};
  const result = findReplacedRefsWithPersonalContent(
    amud({replacedRefs: ["Test 2a:1", "Test 2a:2"]}),
    fakeDriveClient({commentsForRef: ref => (ref === "Test 2a:2" ? commentary : undefined)}));
  expect(result).toEqual(["Test 2a:2"]);
});
