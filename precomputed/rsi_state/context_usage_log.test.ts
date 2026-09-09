import * as fs from "fs";
import {ContextUsageEntry, readContextUsageLog, recordContextUsage} from "./context_usage_log";

// A distinct directory from the real log — see triage_log.test.ts's comment for why this must
// never be the production path. legacyLogPath likewise points somewhere that can't exist, so
// these tests don't pick up the real, already-committed legacy log's entries.
const TEST_LOG_DIR = "precomputed/rsi_state/context_usage_log.test-scratch";
const TEST_LEGACY_LOG_PATH = "precomputed/rsi_state/context_usage_log.test-legacy.jsonl";

afterEach(() => {
  fs.rmSync(TEST_LOG_DIR, {recursive: true, force: true});
  fs.rmSync(TEST_LEGACY_LOG_PATH, {force: true});
});

function entry(overrides: Partial<ContextUsageEntry> = {}): Omit<ContextUsageEntry, "timestamp"> {
  return {
    taskType: "rashi_tosafot_translation",
    ref: "Rashi on Test 2a:1:1",
    callKind: "generate",
    toolUses: [{name: "Read", input: {file_path: "cached_outputs/api_request_handler/Test.2a.json"}}],
    costUsd: 0.01,
    model: "claude-sonnet-5",
    ...overrides,
  };
}

test("readContextUsageLog returns an empty array when nothing has been written", () => {
  expect(readContextUsageLog(TEST_LOG_DIR, TEST_LEGACY_LOG_PATH)).toEqual([]);
});

test("recordContextUsage then readContextUsageLog round-trips, with a timestamp added", () => {
  recordContextUsage(entry(), "Test 2a", TEST_LOG_DIR);
  const log = readContextUsageLog(TEST_LOG_DIR, TEST_LEGACY_LOG_PATH);
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject(entry());
  expect(log[0].timestamp).toEqual(expect.any(String));
});

test("recordContextUsage appends rather than overwriting, within the same page", () => {
  recordContextUsage(entry({ref: "a"}), "Test 2a", TEST_LOG_DIR);
  recordContextUsage(entry({ref: "b"}), "Test 2a", TEST_LOG_DIR);
  recordContextUsage(entry({ref: "a", callKind: "critique"}), "Test 2a", TEST_LOG_DIR);
  const log = readContextUsageLog(TEST_LOG_DIR, TEST_LEGACY_LOG_PATH);
  expect(log.map(e => [e.ref, e.callKind])).toEqual([
    ["a", "generate"],
    ["b", "generate"],
    ["a", "critique"],
  ]);
});

test("different pages land in different files, but readContextUsageLog aggregates all of them", () => {
  recordContextUsage(entry({ref: "a"}), "Test 2a", TEST_LOG_DIR);
  recordContextUsage(entry({ref: "b"}), "Test 3b", TEST_LOG_DIR);

  expect(fs.existsSync(`${TEST_LOG_DIR}/rashi_tosafot_translation/Test 2a.jsonl`)).toBe(true);
  expect(fs.existsSync(`${TEST_LOG_DIR}/rashi_tosafot_translation/Test 3b.jsonl`)).toBe(true);
  const log = readContextUsageLog(TEST_LOG_DIR, TEST_LEGACY_LOG_PATH);
  expect(log.map(e => e.ref).sort()).toEqual(["a", "b"]);
});

test("different task types nest into their own subdirectory", () => {
  recordContextUsage(entry({taskType: "segmentation_audit", ref: "a"}), "Test 2a", TEST_LOG_DIR);

  expect(fs.existsSync(`${TEST_LOG_DIR}/segmentation_audit/Test 2a.jsonl`)).toBe(true);
});

test("readContextUsageLog still includes real historical entries from the pre-split legacy log", () => {
  fs.writeFileSync(TEST_LEGACY_LOG_PATH, `${JSON.stringify({...entry(), timestamp: "t"})}\n`);
  const log = readContextUsageLog(TEST_LOG_DIR, TEST_LEGACY_LOG_PATH);
  expect(log).toHaveLength(1);
});
