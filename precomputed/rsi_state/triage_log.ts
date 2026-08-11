import * as fs from "fs";
import {readUtf8} from "../../files";
import {writeJson} from "../../util/json_files";

/**
 * Which rsi-suggestion GitHub issues have already been triaged, so a scheduled triage run doesn't
 * re-comment on the same issue every time it fires.
 */

const DEFAULT_LOG_PATH = "precomputed/rsi_state/triage_log.json";

interface TriageLog {
  triagedIssueNumbers: number[];
}

function readLog(logPath: string): TriageLog {
  if (!fs.existsSync(logPath)) return {triagedIssueNumbers: []};
  return JSON.parse(readUtf8(logPath)) as TriageLog;
}

// logPath defaults to the real log so production call sites don't need to know it exists, but
// tests can point elsewhere — this file previously had a hardcoded path with no override, and its
// own test's afterEach cleanup (fs.rmSync on that same path) would have silently deleted real
// triaged-issue history the first time this ever ran for real.
export function isAlreadyTriaged(issueNumber: number, logPath = DEFAULT_LOG_PATH): boolean {
  return readLog(logPath).triagedIssueNumbers.includes(issueNumber);
}

export function markTriaged(issueNumber: number, logPath = DEFAULT_LOG_PATH): void {
  const log = readLog(logPath);
  if (log.triagedIssueNumbers.includes(issueNumber)) return;
  log.triagedIssueNumbers.push(issueNumber);
  writeJson(logPath, log);
}
