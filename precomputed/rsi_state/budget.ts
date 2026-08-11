import * as fs from "fs";
import {readUtf8} from "../../files";

/**
 * Human-driven schedule/budget config — hand-edited, not tuned automatically. Enforcement is
 * call-count-based (fully within this code's control), not dollar-based: whether `--max-budget-usd`
 * means anything under Claude Code's subscription billing (rather than metered API billing) is
 * unverified, so this doesn't rely on it. `spend_ledger`-style visibility (see
 * context_usage_log.ts's `model` field and status_cli.ts) is the dollar signal — for looking at,
 * not for enforcing against.
 */

export interface TaskBudgetConfig {
  enabled: boolean;
  maxCallsPerRun: number;
  maxCallsPerDay: number;
  // Lower runs first when schedule_runner.ts has room for more than one task type in a tick.
  priority: number;
}

export interface BudgetConfig {
  // ISO 8601 timestamp; absent when not paused. A one-line edit to halt every task type at
  // once — the "kill switch" for when the user needs their own interactive Claude Code budget
  // for something else.
  pausedUntil?: string;
  taskTypes: Record<string, TaskBudgetConfig>;
}

const EMPTY_CONFIG: BudgetConfig = {taskTypes: {}};

const DEFAULT_CONFIG_PATH = "precomputed/rsi_state/budget_config.json";

export function readBudgetConfig(configPath = DEFAULT_CONFIG_PATH): BudgetConfig {
  if (!fs.existsSync(configPath)) return EMPTY_CONFIG;
  return JSON.parse(readUtf8(configPath)) as BudgetConfig;
}

export function isPaused(config: BudgetConfig, now = new Date()): boolean {
  if (!config.pausedUntil) return false;
  return now < new Date(config.pausedUntil);
}

/** Enabled, not paused, and (if `callsToday` is given) still under today's cap. */
export function isTaskRunnable(
  config: BudgetConfig, taskType: string, callsToday?: number,
): boolean {
  if (isPaused(config)) return false;
  const taskConfig = config.taskTypes[taskType];
  if (!taskConfig || !taskConfig.enabled) return false;
  if (callsToday !== undefined && callsToday >= taskConfig.maxCallsPerDay) return false;
  return true;
}

/** Task types with a config entry, most urgent (lowest `priority` number) first. */
export function runnableTaskTypesByPriority(config: BudgetConfig): string[] {
  return Object.keys(config.taskTypes)
    .sort((a, b) => config.taskTypes[a].priority - config.taskTypes[b].priority);
}
