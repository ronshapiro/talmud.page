import * as fs from "fs";

/**
 * Raw record of what a single headless call actually read, so "how much context does this task
 * type need" can eventually be answered from real usage data instead of a hand-picked commentary
 * allowlist. This module only records; nothing reads or analyzes it yet — there isn't enough
 * volume across real runs yet to derive anything meaningful from it. That analysis (a periodic
 * job proposing a trimmed default view per task type, the way Phase 4's routing tuner proposes
 * model changes) is the next step once this log has real data to learn from.
 */

export interface ToolUseRecord {
  name: string;
  input: unknown;
}

export interface ContextUsageEntry {
  taskType: string;
  ref: string;
  // Which step in the task's flow this call was — e.g. "generate" or "critique" for the
  // translation task type. Free-form per task type; this module doesn't interpret it.
  callKind: string;
  toolUses: ToolUseRecord[];
  costUsd: number | undefined;
  timestamp: string; // ISO 8601
}

const DEFAULT_LOG_PATH = "precomputed/rsi_state/context_usage_log.jsonl";

// logPath defaults to the real log so production call sites don't need to know it exists, but
// tests can point elsewhere — see triage_log.ts for why this matters: a test that deletes the
// default path on cleanup would silently destroy real accumulated data once this is ever run for
// real.

/** Append-only — many entries accumulate per ref (one per generate/critique call, including
 * retries), so this is a log, not a keyed record like generation_record.ts. */
export function recordContextUsage(
  entry: Omit<ContextUsageEntry, "timestamp">, logPath = DEFAULT_LOG_PATH,
): void {
  const full: ContextUsageEntry = {...entry, timestamp: new Date().toISOString()};
  fs.appendFileSync(logPath, `${JSON.stringify(full)}\n`);
}

export function readContextUsageLog(logPath = DEFAULT_LOG_PATH): ContextUsageEntry[] {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, "utf-8")
    .split("\n")
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as ContextUsageEntry);
}
