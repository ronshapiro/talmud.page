import * as fs from "fs";
import {ContextUsageEntry, readContextUsageLog, recordContextUsage} from "./context_usage_log";

// A distinct path from the real log — see triage_log.test.ts's comment for why this must never
// be the production path.
const TEST_LOG_PATH = "precomputed/rsi_state/context_usage_log.test.jsonl";

afterEach(() => {
  fs.rmSync(TEST_LOG_PATH, {force: true});
});

function entry(overrides: Partial<ContextUsageEntry> = {}): Omit<ContextUsageEntry, "timestamp"> {
  return {
    taskType: "rashi_tosafot_translation",
    ref: "Rashi on Test 2a:1:1",
    callKind: "generate",
    toolUses: [{name: "Read", input: {file_path: "cached_outputs/api_request_handler/Test.2a.json"}}],
    costUsd: 0.01,
    ...overrides,
  };
}

test("readContextUsageLog returns an empty array when nothing has been written", () => {
  expect(readContextUsageLog(TEST_LOG_PATH)).toEqual([]);
});

test("recordContextUsage then readContextUsageLog round-trips, with a timestamp added", () => {
  recordContextUsage(entry(), TEST_LOG_PATH);
  const log = readContextUsageLog(TEST_LOG_PATH);
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject(entry());
  expect(log[0].timestamp).toEqual(expect.any(String));
});

test("recordContextUsage appends rather than overwriting", () => {
  recordContextUsage(entry({ref: "a"}), TEST_LOG_PATH);
  recordContextUsage(entry({ref: "b"}), TEST_LOG_PATH);
  recordContextUsage(entry({ref: "a", callKind: "critique"}), TEST_LOG_PATH);
  const log = readContextUsageLog(TEST_LOG_PATH);
  expect(log.map(e => [e.ref, e.callKind])).toEqual([
    ["a", "generate"],
    ["b", "generate"],
    ["a", "critique"],
  ]);
});
