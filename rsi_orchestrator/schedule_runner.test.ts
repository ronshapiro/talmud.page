import {BudgetConfig} from "../precomputed/rsi_state/budget";
import {runScheduledTick, ScheduledTickDeps, TaskRunner} from "./schedule_runner";

function config(overrides: Partial<BudgetConfig> = {}): BudgetConfig {
  return {
    taskTypes: {
      task_a: {enabled: true, maxCallsPerRun: 5, maxCallsPerDay: 20, priority: 1},
    },
    ...overrides,
  };
}

function deps(overrides: Partial<ScheduledTickDeps> = {}): ScheduledTickDeps {
  return {
    config: config(),
    callsToday: () => 0,
    runners: {task_a: jest.fn(async () => {})},
    ...overrides,
  };
}

test("does nothing when globally paused", async () => {
  const runner: TaskRunner = jest.fn(async () => {});
  await runScheduledTick(deps({
    config: config({pausedUntil: new Date(Date.now() + 60_000).toISOString()}),
    runners: {task_a: runner},
  }));
  expect(runner).not.toHaveBeenCalled();
});

test("runs an enabled, under-cap task type", async () => {
  const runner: TaskRunner = jest.fn(async () => {});
  await runScheduledTick(deps({runners: {task_a: runner}}));
  expect(runner).toHaveBeenCalledWith(5); // maxCallsPerRun, since nothing used today
});

test("caps maxCalls at the remaining daily budget, not just maxCallsPerRun", async () => {
  const runner: TaskRunner = jest.fn(async () => {});
  await runScheduledTick(deps({
    callsToday: () => 18, // 20 - 18 = 2 remaining, less than maxCallsPerRun (5)
    runners: {task_a: runner},
  }));
  expect(runner).toHaveBeenCalledWith(2);
});

test("skips a task type that's already at its daily cap", async () => {
  const runner: TaskRunner = jest.fn(async () => {});
  await runScheduledTick(deps({callsToday: () => 20, runners: {task_a: runner}}));
  expect(runner).not.toHaveBeenCalled();
});

test("skips a disabled task type", async () => {
  const runner: TaskRunner = jest.fn(async () => {});
  const disabled = config({
    taskTypes: {task_a: {enabled: false, maxCallsPerRun: 5, maxCallsPerDay: 20, priority: 1}},
  });
  await runScheduledTick(deps({config: disabled, runners: {task_a: runner}}));
  expect(runner).not.toHaveBeenCalled();
});

test("skips a task type with no registered runner, without throwing", async () => {
  const unregistered = config({
    taskTypes: {
      no_runner_task: {enabled: true, maxCallsPerRun: 5, maxCallsPerDay: 20, priority: 1},
    },
  });
  const result = runScheduledTick(deps({config: unregistered, runners: {}}));
  await expect(result).resolves.toBeUndefined();
});

test("runs multiple task types in priority order", async () => {
  const order: string[] = [];
  const multi = config({
    taskTypes: {
      low: {enabled: true, maxCallsPerRun: 1, maxCallsPerDay: 1, priority: 5},
      high: {enabled: true, maxCallsPerRun: 1, maxCallsPerDay: 1, priority: 1},
    },
  });
  await runScheduledTick(deps({
    config: multi,
    runners: {
      low: async () => { order.push("low"); },
      high: async () => { order.push("high"); },
    },
  }));
  expect(order).toEqual(["high", "low"]);
});
