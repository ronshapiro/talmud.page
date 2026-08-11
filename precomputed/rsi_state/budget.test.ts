import * as fs from "fs";
import {writeJson} from "../../util/json_files";
import {
  BudgetConfig,
  isPaused,
  isTaskRunnable,
  readBudgetConfig,
  runnableTaskTypesByPriority,
} from "./budget";

const CONFIG_PATH = "precomputed/rsi_state/__test_budget_config__.json";

afterEach(() => {
  fs.rmSync(CONFIG_PATH, {force: true});
});

function config(overrides: Partial<BudgetConfig> = {}): BudgetConfig {
  return {
    taskTypes: {
      my_task: {enabled: true, maxCallsPerRun: 5, maxCallsPerDay: 20, priority: 1},
    },
    ...overrides,
  };
}

test("readBudgetConfig returns an empty config when there's no file", () => {
  expect(readBudgetConfig(CONFIG_PATH)).toEqual({taskTypes: {}});
});

test("readBudgetConfig reads a written config file", () => {
  writeJson(CONFIG_PATH, config());
  expect(readBudgetConfig(CONFIG_PATH)).toEqual(config());
});

describe("isPaused", () => {
  test("false when pausedUntil is absent", () => {
    expect(isPaused(config())).toBe(false);
  });

  test("true when pausedUntil is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isPaused(config({pausedUntil: future}))).toBe(true);
  });

  test("false when pausedUntil is in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isPaused(config({pausedUntil: past}))).toBe(false);
  });
});

describe("isTaskRunnable", () => {
  test("true for an enabled, unpaused, under-cap task type", () => {
    expect(isTaskRunnable(config(), "my_task", 3)).toBe(true);
  });

  test("false when globally paused", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isTaskRunnable(config({pausedUntil: future}), "my_task", 0)).toBe(false);
  });

  test("false when the task type has no config entry", () => {
    expect(isTaskRunnable(config(), "unconfigured_task", 0)).toBe(false);
  });

  test("false when the task type is disabled", () => {
    const disabled = config({
      taskTypes: {my_task: {enabled: false, maxCallsPerRun: 5, maxCallsPerDay: 20, priority: 1}},
    });
    expect(isTaskRunnable(disabled, "my_task", 0)).toBe(false);
  });

  test("false when today's call count has reached the daily cap", () => {
    expect(isTaskRunnable(config(), "my_task", 20)).toBe(false);
  });

  test("ignores the cap when callsToday isn't given", () => {
    expect(isTaskRunnable(config(), "my_task")).toBe(true);
  });
});

test("runnableTaskTypesByPriority sorts by ascending priority", () => {
  const multi = config({
    taskTypes: {
      low_priority: {enabled: true, maxCallsPerRun: 1, maxCallsPerDay: 1, priority: 5},
      high_priority: {enabled: true, maxCallsPerRun: 1, maxCallsPerDay: 1, priority: 1},
      mid_priority: {enabled: true, maxCallsPerRun: 1, maxCallsPerDay: 1, priority: 3},
    },
  });
  expect(runnableTaskTypesByPriority(multi)).toEqual(["high_priority", "mid_priority", "low_priority"]);
});
