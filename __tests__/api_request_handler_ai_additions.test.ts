/* eslint-disable import/first */
jest.mock("../fetch.ts", () => ({fetch: "unused"}));
jest.mock("../source_formatting/html_sanitization_node.ts", () => {
  // eslint-disable-next-line global-require,@typescript-eslint/no-var-requires
  const {sanitizeHtml} = require("../source_formatting/html_sanitization_web");
  return {sanitizeHtml};
});

import * as fs from "fs";
import {AbstractApiRequestHandler, Comment, InternalSegment} from "../api_request_handler";
import {FakeRequestMaker, TEST_DATA_ROOT} from "../request_makers";
import {NoopLogger} from "../logger";
import {writeAiEdit, OUTPUT_DIR as AI_OUTPUT_DIR} from "../precomputed/ai_edits";
import {upsertGenerationRecord} from "../precomputed/rsi_state/generation_record";

const TEST_PAGE = "__Test_Ai_Page__ 2a";
const TEST_TASK_TYPE = "rashi_tosafot_translation";

class TestHandler extends AbstractApiRequestHandler {
  makeId() { return "test-id"; }
  makeTitleHebrew() { return "test-title-he"; }
  override pageRef() { return TEST_PAGE; }
  book(): any {
    return {
      bookNameForRef: () => "Test",
      rewriteSectionRef: (x: string) => x,
    };
  }
}

function createHandler(): TestHandler {
  return new TestHandler("TestBook", "2a", new FakeRequestMaker(TEST_DATA_ROOT), new NoopLogger());
}

afterEach(() => {
  fs.rmSync(`${AI_OUTPUT_DIR}/${TEST_PAGE}.json`, {force: true});
  fs.rmSync(`precomputed/rsi_state/generation_records/${TEST_TASK_TYPE}/${TEST_PAGE}.json`, {force: true});
});

test("pending RSI comment gets Model subcomment from generation record", () => {
  const commentRef = "Rashi on __Test_Ai_Page__ 2a:1:1";
  writeAiEdit(TEST_PAGE, commentRef, {
    hebrew: "עברית חדשה",
    english: "new english",
    status: "pending",
  });
  upsertGenerationRecord(TEST_TASK_TYPE, TEST_PAGE, commentRef, {
    sourceRefs: [commentRef],
    sourceText: "עברית מקורית",
    model: "claude-sonnet-5",
    promptVersion: "v2",
    generatedAt: "2026-09-08T00:00:00.000Z",
    dependsOn: [],
  });

  const handler = createHandler();
  const segment = new InternalSegment({
    hebrew: "עברית מקורית של קטע",
    english: "original segment english",
    ref: `${TEST_PAGE}:1`,
  });
  const rashi = new Comment(
    "Rashi",
    "עברית מקורית",
    "",
    commentRef,
    commentRef,
    'רש"י',
  );
  segment.commentary.addComment(rashi);

  (handler as any).addAiAdditions([segment]);

  const json = segment.toJson();
  const rashiComment = json.commentary!.Rashi.comments[0];
  expect(rashiComment).toBeDefined();

  const aiVersion = rashiComment.commentary!.Versions.comments[0];
  expect(aiVersion).toBeDefined();
  expect(aiVersion.sourceRef).toBe("AI Edit");
  expect(aiVersion.pendingReview).toBe(TEST_PAGE);

  const modelCommentary = aiVersion.commentary?.Model;
  expect(modelCommentary).toBeDefined();
  expect(modelCommentary!.comments).toHaveLength(1);
  expect(modelCommentary!.comments[0]).toEqual({
    ref: `${commentRef}-model`,
    he: "claude-sonnet-5",
    en: "claude-sonnet-5",
    sourceRef: "Model",
    sourceHeRef: "מודל",
  });
});

test("model field on Edit takes precedence over generation record", () => {
  const commentRef = "Rashi on __Test_Ai_Page__ 2a:1:1";
  writeAiEdit(TEST_PAGE, commentRef, {
    hebrew: "עברית חדשה",
    english: "new english",
    status: "pending",
    model: "gemini-2.5-pro",
  });
  upsertGenerationRecord(TEST_TASK_TYPE, TEST_PAGE, commentRef, {
    sourceRefs: [commentRef],
    sourceText: "עברית מקורית",
    model: "claude-sonnet-5",
    promptVersion: "v2",
    generatedAt: "2026-09-08T00:00:00.000Z",
    dependsOn: [],
  });

  const handler = createHandler();
  const segment = new InternalSegment({
    hebrew: "עברית",
    english: "english",
    ref: `${TEST_PAGE}:1`,
  });
  const rashi = new Comment(
    "Rashi",
    "עברית מקורית",
    "",
    commentRef,
    commentRef,
    'רש"י',
  );
  segment.commentary.addComment(rashi);

  (handler as any).addAiAdditions([segment]);

  const json = segment.toJson();
  const aiVersion = json.commentary!.Rashi.comments[0].commentary!.Versions.comments[0];
  expect(aiVersion.commentary?.Model.comments[0].en).toBe("gemini-2.5-pro");
});

test("non-pending AI comment does not get a Model subcomment", () => {
  const commentRef = "Rashi on __Test_Ai_Page__ 2a:1:1";
  writeAiEdit(TEST_PAGE, commentRef, {
    hebrew: "עברית חדשה",
    english: "new english",
    // status is not pending (approved/shipped)
    model: "claude-sonnet-5",
  });

  const handler = createHandler();
  const segment = new InternalSegment({
    hebrew: "עברית",
    english: "english",
    ref: `${TEST_PAGE}:1`,
  });
  const rashi = new Comment(
    "Rashi",
    "עברית מקורית",
    "",
    commentRef,
    commentRef,
    'רש"י',
  );
  segment.commentary.addComment(rashi);

  (handler as any).addAiAdditions([segment]);

  const json = segment.toJson();
  const aiVersion = json.commentary!.Rashi.comments[0].commentary!.Versions.comments[0];
  expect(aiVersion.pendingReview).toBeUndefined();
  expect(aiVersion.commentary?.Model).toBeUndefined();
});

test("pending segment-level addition gets Model subcomment", () => {
  const segmentRef = `${TEST_PAGE}:1`;
  writeAiEdit(TEST_PAGE, segmentRef, {
    hebrew: "עברית חדשה לקטע",
    english: "new segment english",
    status: "pending",
    model: "claude-haiku-4-5",
  });

  const handler = createHandler();
  const segment = new InternalSegment({
    hebrew: "עברית",
    english: "english",
    ref: segmentRef,
  });

  (handler as any).addAiAdditions([segment]);

  const json = segment.toJson();
  const aiVersion = json.commentary!.Versions.comments[0];
  expect(aiVersion).toBeDefined();
  expect(aiVersion.pendingReview).toBe(TEST_PAGE);
  expect(aiVersion.commentary?.Model.comments[0]).toEqual({
    ref: `${segmentRef}-model`,
    he: "claude-haiku-4-5",
    en: "claude-haiku-4-5",
    sourceRef: "Model",
    sourceHeRef: "מודל",
  });
});
