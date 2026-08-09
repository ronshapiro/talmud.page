import * as fs from "fs";
import {
  findDependentsOnPage,
  GenerationRecord,
  readGenerationRecord,
  readGenerationRecordsForPage,
  upsertGenerationRecord,
} from "./generation_record";

const TASK_TYPE = "__test_task_type__";
const PAGE = "__Test_Page__ 2a";

function record(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
  return {
    sourceRefs: ["Test 2a:1"],
    sourceText: "original text",
    model: "claude-opus-5",
    promptVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    dependsOn: [],
    ...overrides,
  };
}

afterEach(() => {
  fs.rmSync(`precomputed/rsi_state/generation_records/${TASK_TYPE}`, {recursive: true, force: true});
});

test("readGenerationRecordsForPage returns an empty object when nothing has been written", () => {
  expect(readGenerationRecordsForPage(TASK_TYPE, PAGE)).toEqual({});
});

test("upsertGenerationRecord then readGenerationRecord round-trips", () => {
  upsertGenerationRecord(TASK_TYPE, PAGE, "Test 2a:1", record());
  expect(readGenerationRecord(TASK_TYPE, PAGE, "Test 2a:1")).toEqual(record());
});

test("upsertGenerationRecord preserves other refs already on the page", () => {
  upsertGenerationRecord(TASK_TYPE, PAGE, "Test 2a:1", record());
  upsertGenerationRecord(TASK_TYPE, PAGE, "Test 2a:2", record({sourceRefs: ["Test 2a:2"]}));

  const records = readGenerationRecordsForPage(TASK_TYPE, PAGE);
  expect(Object.keys(records).sort()).toEqual(["Test 2a:1", "Test 2a:2"]);
});

test("readGenerationRecord returns undefined for a ref that was never written", () => {
  upsertGenerationRecord(TASK_TYPE, PAGE, "Test 2a:1", record());
  expect(readGenerationRecord(TASK_TYPE, PAGE, "Test 2a:99")).toBeUndefined();
});

test("findDependentsOnPage finds refs that declare a dependency", () => {
  upsertGenerationRecord(TASK_TYPE, PAGE, "Test 2a:1", record());
  upsertGenerationRecord(
    TASK_TYPE, PAGE, "Test 2a:2",
    record({sourceRefs: ["Test 2a:2"], dependsOn: ["Test 2a:1"]}));
  upsertGenerationRecord(
    TASK_TYPE, PAGE, "Test 2a:3",
    record({sourceRefs: ["Test 2a:3"], dependsOn: []}));

  expect(findDependentsOnPage(TASK_TYPE, PAGE, "Test 2a:1").sort())
    .toEqual(["Test 2a:1", "Test 2a:2"]); // includes itself, since sourceRefs also matches
});
