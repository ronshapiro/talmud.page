import {BudgetConfig} from "../precomputed/rsi_state/budget";
import {ContextUsageEntry} from "../precomputed/rsi_state/context_usage_log";
import {computeTaskStatuses, formatStatus} from "./status_cli";

const NOW = new Date("2026-01-15T12:00:00.000Z");

function config(overrides: Partial<BudgetConfig> = {}): BudgetConfig {
  return {
    taskTypes: {
      my_task: {enabled: true, maxCallsPerRun: 5, maxCallsPerDay: 20, priority: 1},
    },
    ...overrides,
  };
}

function entry(overrides: Partial<ContextUsageEntry> = {}): ContextUsageEntry {
  return {
    taskType: "my_task",
    ref: "Test 2a:1",
    callKind: "generate",
    toolUses: [],
    costUsd: 0.1,
    model: "claude-sonnet-5",
    timestamp: NOW.toISOString(),
    ...overrides,
  };
}

describe("computeTaskStatuses", () => {
  test("counts calls and sums cost for today", () => {
    const log = [entry({costUsd: 0.1}), entry({costUsd: 0.2})];
    const [status] = computeTaskStatuses(config(), log, NOW);
    expect(status.taskType).toEqual("my_task");
    expect(status.enabled).toBe(true);
    expect(status.callsToday).toBe(2);
    expect(status.maxCallsPerDay).toBe(20);
    expect(status.costUsdToday).toBeCloseTo(0.3);
    expect(status.callsThisWeek).toBe(2);
    expect(status.costUsdThisWeek).toBeCloseTo(0.3);
  });

  test("excludes calls from other task types", () => {
    const log = [entry({taskType: "other_task"})];
    const [status] = computeTaskStatuses(config(), log, NOW);
    expect(status.callsToday).toBe(0);
  });

  test("excludes calls from before today but within the week from callsToday", () => {
    const yesterday = new Date(NOW.getTime() - 26 * 60 * 60 * 1000).toISOString();
    const log = [entry({timestamp: yesterday})];
    const [status] = computeTaskStatuses(config(), log, NOW);
    expect(status.callsToday).toBe(0);
    expect(status.callsThisWeek).toBe(1);
  });

  test("excludes calls from over a week ago", () => {
    const longAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const log = [entry({timestamp: longAgo})];
    const [status] = computeTaskStatuses(config(), log, NOW);
    expect(status.callsThisWeek).toBe(0);
  });

  test("treats undefined costUsd as zero", () => {
    const log = [entry({costUsd: undefined})];
    const [status] = computeTaskStatuses(config(), log, NOW);
    expect(status.costUsdToday).toBe(0);
  });
});

describe("formatStatus", () => {
  test("reports not paused and per-task-type stats", () => {
    const statuses = computeTaskStatuses(config(), [entry()], NOW);
    const output = formatStatus(config(), statuses, NOW);
    expect(output).toContain("Not paused.");
    expect(output).toContain("my_task: enabled");
    expect(output).toContain("1/20 calls today");
  });

  test("reports paused state with the pausedUntil timestamp", () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    const paused = config({pausedUntil: future});
    const output = formatStatus(paused, computeTaskStatuses(paused, [], NOW), NOW);
    expect(output).toContain(`PAUSED until ${future}`);
  });

  test("notes when no task types are configured", () => {
    const empty = config({taskTypes: {}});
    const output = formatStatus(empty, [], NOW);
    expect(output).toContain("No task types configured");
  });
});
