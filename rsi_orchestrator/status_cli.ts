import {BudgetConfig, isPaused, readBudgetConfig} from "../precomputed/rsi_state/budget";
import {ContextUsageEntry, readContextUsageLog} from "../precomputed/rsi_state/context_usage_log";

/**
 * `npx ts-node rsi_orchestrator/status_cli.ts` — the "control panel" half of the human-driven
 * schedule (the other half is hand-editing budget_config.json). Prints today's/this week's call
 * counts and cost per task type against the configured caps, and whether anything is currently
 * paused — read this before deciding whether to enable a task type, raise a cap, or pause
 * everything before doing unrelated Claude Code work.
 */

export interface TaskStatus {
  taskType: string;
  enabled: boolean;
  callsToday: number;
  maxCallsPerDay: number;
  costUsdToday: number;
  callsThisWeek: number;
  costUsdThisWeek: number;
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isWithinPastDays(timestamp: string, now: Date, days: number): boolean {
  return new Date(timestamp).getTime() >= now.getTime() - days * MILLIS_PER_DAY;
}

function sumCost(entries: ContextUsageEntry[]): number {
  return entries.reduce((total, entry) => total + (entry.costUsd ?? 0), 0);
}

export function computeTaskStatuses(
  config: BudgetConfig, log: ContextUsageEntry[], now = new Date(),
): TaskStatus[] {
  return Object.entries(config.taskTypes).map(([taskType, taskConfig]) => {
    const entries = log.filter(entry => entry.taskType === taskType);
    const today = entries.filter(entry => isSameUtcDay(new Date(entry.timestamp), now));
    const thisWeek = entries.filter(entry => isWithinPastDays(entry.timestamp, now, 7));
    return {
      taskType,
      enabled: taskConfig.enabled,
      callsToday: today.length,
      maxCallsPerDay: taskConfig.maxCallsPerDay,
      costUsdToday: sumCost(today),
      callsThisWeek: thisWeek.length,
      costUsdThisWeek: sumCost(thisWeek),
    };
  });
}

export function formatStatus(
  config: BudgetConfig, statuses: TaskStatus[], now = new Date(),
): string {
  const lines: string[] = [
    isPaused(config, now) ? `PAUSED until ${config.pausedUntil ?? ""}` : "Not paused.",
    "",
  ];
  if (statuses.length === 0) {
    lines.push("No task types configured in budget_config.json.");
  }
  for (const status of statuses) {
    lines.push(
      `${status.taskType}: ${status.enabled ? "enabled" : "disabled"} — `
      + `${status.callsToday}/${status.maxCallsPerDay} calls today `
      + `($${status.costUsdToday.toFixed(2)}), `
      + `${status.callsThisWeek} calls this week ($${status.costUsdThisWeek.toFixed(2)})`);
  }
  return lines.join("\n");
}

function main(): void {
  const config = readBudgetConfig();
  const log = readContextUsageLog();
  console.log(formatStatus(config, computeTaskStatuses(config, log)));
}

if (require.main === module) {
  main();
}
