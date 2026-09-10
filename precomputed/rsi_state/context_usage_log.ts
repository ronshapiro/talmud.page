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
  // The canonical model ID that did the work (AgentResult.model) — doubles this log as
  // the spend/budget ledger (see budget.ts's status reporting) rather than needing a second,
  // separately-written log that could drift out of sync with this one.
  model: string | undefined;
  timestamp: string; // ISO 8601
}

const DEFAULT_LOG_DIR = "precomputed/rsi_state/context_usage_log";
// Every entry recorded before the per-page split above lived here. Still read for continuity
// with real historical data already committed; never written to again.
const LEGACY_LOG_PATH = "precomputed/rsi_state/context_usage_log.jsonl";

function logFilePath(taskType: string, page: string, logDir: string): string {
  return `${logDir}/${taskType}/${page}.jsonl`;
}

/** Append-only — many entries accumulate per ref (one per generate/critique call, including
 * retries), so this is a log, not a keyed record like generation_record.ts. */
export function recordContextUsage(
  entry: Omit<ContextUsageEntry, "timestamp">, page: string, logDir = DEFAULT_LOG_DIR,
): void {
  const full: ContextUsageEntry = {...entry, timestamp: new Date().toISOString()};
  const filePath = logFilePath(entry.taskType, page, logDir);
  fs.mkdirSync(filePath.slice(0, filePath.lastIndexOf("/")), {recursive: true});
  fs.appendFileSync(filePath, `${JSON.stringify(full)}\n`);
}

function readJsonlFile(filePath: string): ContextUsageEntry[] {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf-8")
    .split("\n")
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as ContextUsageEntry);
}

function allPageLogFiles(logDir: string): string[] {
  if (!fs.existsSync(logDir)) return [];
  const files: string[] = [];
  for (const taskType of fs.readdirSync(logDir)) {
    const taskDir = `${logDir}/${taskType}`;
    if (!fs.statSync(taskDir).isDirectory()) continue;
    for (const file of fs.readdirSync(taskDir)) {
      if (file.endsWith(".jsonl")) files.push(`${taskDir}/${file}`);
    }
  }
  return files;
}

/** Every entry across every page (and task type) — callers that need "calls today" or similar
 * aggregates already filter/reduce this themselves; this module doesn't interpret callKind or
 * taskType beyond storing them. `legacyLogPath` is a separate override (not folded into `logDir`)
 * so a test can point `logDir` at an empty scratch directory without also picking up the real,
 * already-committed legacy file's entries. */
export function readContextUsageLog(
  logDir = DEFAULT_LOG_DIR, legacyLogPath = LEGACY_LOG_PATH,
): ContextUsageEntry[] {
  return [...readJsonlFile(legacyLogPath), ...allPageLogFiles(logDir).flatMap(readJsonlFile)];
}
