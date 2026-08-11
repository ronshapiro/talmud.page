import * as fs from "fs";
import {isAlreadyTriaged, markTriaged} from "./triage_log";

// A distinct path from the real log — this test used to operate on the production path directly,
// so running the suite after a real triage run would have silently deleted real history.
const TEST_LOG_PATH = "precomputed/rsi_state/triage_log.test.json";

afterEach(() => {
  fs.rmSync(TEST_LOG_PATH, {force: true});
});

test("isAlreadyTriaged is false when the log doesn't exist yet", () => {
  expect(isAlreadyTriaged(1, TEST_LOG_PATH)).toBe(false);
});

test("markTriaged then isAlreadyTriaged round-trips", () => {
  markTriaged(5, TEST_LOG_PATH);
  expect(isAlreadyTriaged(5, TEST_LOG_PATH)).toBe(true);
  expect(isAlreadyTriaged(6, TEST_LOG_PATH)).toBe(false);
});

test("markTriaged is idempotent", () => {
  markTriaged(9, TEST_LOG_PATH);
  markTriaged(9, TEST_LOG_PATH);
  const log = JSON.parse(fs.readFileSync(TEST_LOG_PATH, "utf-8")) as {triagedIssueNumbers: number[]};
  expect(log.triagedIssueNumbers).toEqual([9]);
});

test("markTriaged preserves previously logged issue numbers", () => {
  markTriaged(1, TEST_LOG_PATH);
  markTriaged(2, TEST_LOG_PATH);
  expect(isAlreadyTriaged(1, TEST_LOG_PATH)).toBe(true);
  expect(isAlreadyTriaged(2, TEST_LOG_PATH)).toBe(true);
});
