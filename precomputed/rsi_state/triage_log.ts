import * as fs from "fs";
import {readUtf8} from "../../files";
import {writeJson} from "../../util/json_files";

/**
 * Which rsi-suggestion GitHub issues have already been triaged, so a scheduled triage run doesn't
 * re-comment on the same issue every time it fires.
 */

const LOG_PATH = "precomputed/rsi_state/triage_log.json";

interface TriageLog {
  triagedIssueNumbers: number[];
}

function readLog(): TriageLog {
  if (!fs.existsSync(LOG_PATH)) return {triagedIssueNumbers: []};
  return JSON.parse(readUtf8(LOG_PATH)) as TriageLog;
}

export function isAlreadyTriaged(issueNumber: number): boolean {
  return readLog().triagedIssueNumbers.includes(issueNumber);
}

export function markTriaged(issueNumber: number): void {
  const log = readLog();
  if (log.triagedIssueNumbers.includes(issueNumber)) return;
  log.triagedIssueNumbers.push(issueNumber);
  writeJson(LOG_PATH, log);
}
