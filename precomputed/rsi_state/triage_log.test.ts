import * as fs from "fs";
import {isAlreadyTriaged, markTriaged} from "./triage_log";

const LOG_PATH = "precomputed/rsi_state/triage_log.json";

afterEach(() => {
  fs.rmSync(LOG_PATH, {force: true});
});

test("isAlreadyTriaged is false when the log doesn't exist yet", () => {
  expect(isAlreadyTriaged(1)).toBe(false);
});

test("markTriaged then isAlreadyTriaged round-trips", () => {
  markTriaged(5);
  expect(isAlreadyTriaged(5)).toBe(true);
  expect(isAlreadyTriaged(6)).toBe(false);
});

test("markTriaged is idempotent", () => {
  markTriaged(9);
  markTriaged(9);
  const log = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as {triagedIssueNumbers: number[]};
  expect(log.triagedIssueNumbers).toEqual([9]);
});

test("markTriaged preserves previously logged issue numbers", () => {
  markTriaged(1);
  markTriaged(2);
  expect(isAlreadyTriaged(1)).toBe(true);
  expect(isAlreadyTriaged(2)).toBe(true);
});
