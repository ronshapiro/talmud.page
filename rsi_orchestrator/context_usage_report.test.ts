import {ContextUsageEntry} from "../precomputed/rsi_state/context_usage_log";
import {computeContextReport, formatContextReport} from "./context_usage_report";

const CLI = "npx ts-node rsi_orchestrator/context_fetch_cli.ts";

function entry(
  overrides: Partial<ContextUsageEntry> = {}, commands: string[] = [],
): ContextUsageEntry {
  return {
    taskType: "rashi_tosafot_translation",
    ref: "Rashi on Arakhin 10a:2:1",
    callKind: "generate",
    toolUses: commands.map(command => ({name: "Bash", input: {command}})),
    costUsd: 0.1,
    model: "claude-sonnet-5-20260101",
    timestamp: "2026-10-20T00:00:00Z",
    ...overrides,
  };
}

test("classifies requested refs relative to the target comment's page", () => {
  const [stats] = computeContextReport([entry({}, [
    `${CLI} get-refs '["Arakhin 10a:2", "Arakhin 9b:17", "Arakhin 2a:1", "Sukkah 53b:7-9"]'`,
    // The same command logged twice within one call counts once.
    `${CLI} get-refs '["Arakhin 10a:2", "Arakhin 9b:17", "Arakhin 2a:1", "Sukkah 53b:7-9"]'`,
    `${CLI} wikipedia "Trumpet"`,
  ])]);
  expect(stats).toEqual({
    model: "claude-sonnet-5",
    calls: 1,
    fetchingCalls: 1,
    refs: 4,
    ownSegmentCalls: 1,
    offPageRefs: 3,
    offBookRefs: 1,
    earlyPageRefs: 1,
    commands: {"get-refs": 1, wikipedia: 1},
    costUsd: 0.1,
  });
});

test("resolves book aliases to the same book", () => {
  const [stats] = computeContextReport([entry({ref: "Rashi on Chullin 11a:2:1"}, [
    `${CLI} get-refs '["Hullin 10b:7"]'`,
  ])]);
  expect(stats.offPageRefs).toBe(1);
  expect(stats.offBookRefs).toBe(0);
});

test("ignores prose that merely mentions the CLI", () => {
  const [stats] = computeContextReport([entry({}, ["echo use context_fetch_cli to look things up"])]);
  expect(stats.fetchingCalls).toBe(0);
  expect(stats.commands).toEqual({});
});

test("filters by callKind, taskType, and since", () => {
  const log = [
    entry(),
    entry({callKind: "critique"}),
    entry({taskType: "other"}),
    entry({timestamp: "2026-09-01T00:00:00Z"}),
  ];
  const [stats] = computeContextReport(log, {
    since: new Date("2026-10-01"), taskType: "rashi_tosafot_translation",
  });
  expect(stats.calls).toBe(1);
});

test("formats one row per model, busiest first", () => {
  const formatted = formatContextReport(computeContextReport([
    entry({model: "gemini-3.8-flash-high"}, [`${CLI} get-refs '["Arakhin 10a:2"]'`]),
    entry({model: "gemini-3.8-flash-high"}),
    entry(),
  ]));
  const lines = formatted.split("\n");
  expect(lines[0]).toMatch(/^model\s+calls\s+fetch%/);
  expect(lines[1]).toMatch(/^gemini-3.8-flash-high\s+2\s+50%\s+1.0\s+100%/);
  expect(lines[2]).toMatch(/^claude-sonnet-5\s+1\s+0%/);
});

test("formats an empty report", () => {
  expect(formatContextReport([])).toMatch(/No matching calls/);
});
