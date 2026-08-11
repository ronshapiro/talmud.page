import {books} from "../books";
import {writeAiEdit} from "../precomputed/ai_edits";
import {
  BudgetConfig,
  isPaused,
  isTaskRunnable,
  readBudgetConfig,
  runnableTaskTypesByPriority,
} from "../precomputed/rsi_state/budget";
import {readContextUsageLog} from "../precomputed/rsi_state/context_usage_log";
import {
  generateAndRecord,
  isFreshTranslation,
  listCandidatesForBook,
  recordGenerationForCandidate,
  TASK_TYPE as RASHI_TOSAFOT_TRANSLATION,
  translateRashiTosafotComments,
} from "./rashi_tosafot_translation";

/**
 * `npx ts-node rsi_orchestrator/schedule_runner.ts` — the cron/launchd entrypoint (see README.md's
 * "Scheduling" section for the launchd plist template; not installed by default). Each tick reads
 * budget_config.json, runs one bounded batch per enabled/under-cap/unpaused task type, then stops —
 * deliberately never an open-ended run, so a `pausedUntil` edit takes effect within one tick and a
 * rate-limit hit only costs one tick's wall-clock, not a whole session. The schedule itself is
 * human-driven: nothing here decides caps or which task types run — that's entirely
 * budget_config.json, hand-edited (see status_cli.ts for the read side of that loop).
 */

export type TaskRunner = (maxCalls: number) => Promise<void>;

async function runRashiTosafotTranslation(maxCalls: number): Promise<void> {
  await translateRashiTosafotComments({
    listCandidates: () => {
      const candidates = [];
      for (const book of books.allBooks) candidates.push(...listCandidatesForBook(book));
      // Filter freshness before slicing to maxCalls — otherwise a small cap against a corpus with
      // a long run of already-fresh candidates at the start could silently do nothing (the same
      // bug rashi_tosafot_translation_cli.ts's --limit hit for real; see its comment).
      return candidates.filter(c => !isFreshTranslation(c)).slice(0, maxCalls);
    },
    isFresh: isFreshTranslation,
    generate: generateAndRecord,
    writeEdit: (candidate, edit) => writeAiEdit(candidate.page, candidate.ref, edit),
    recordGeneration: recordGenerationForCandidate,
  });
}

// Known gap: if translateRashiTosafotComments stops early on a rate limit, that's swallowed
// internally (it just returns) rather than propagated here — with only one task type registered,
// a session-wide rate limit and "this task type is done for now" look the same. Once a second task
// type exists, this should propagate a "stop the whole tick" signal instead of letting the loop
// below move on to try another task type against the same wall.
export const TASK_RUNNERS: Record<string, TaskRunner> = {
  [RASHI_TOSAFOT_TRANSLATION]: runRashiTosafotTranslation,
};

export interface ScheduledTickDeps {
  config: BudgetConfig;
  callsToday: (taskType: string) => number;
  runners: Record<string, TaskRunner>;
  now?: Date;
}

export async function runScheduledTick(deps: ScheduledTickDeps): Promise<void> {
  if (isPaused(deps.config, deps.now)) {
    console.log(`Paused until ${deps.config.pausedUntil ?? ""} — nothing to do this tick.`);
    return;
  }
  for (const taskType of runnableTaskTypesByPriority(deps.config)) {
    const taskConfig = deps.config.taskTypes[taskType];
    const callsToday = deps.callsToday(taskType);
    if (!isTaskRunnable(deps.config, taskType, callsToday)) continue;
    const runner = deps.runners[taskType];
    if (!runner) {
      console.error(`No runner registered for task type "${taskType}" — skipping.`);
      continue;
    }
    const maxCalls = Math.min(taskConfig.maxCallsPerRun, taskConfig.maxCallsPerDay - callsToday);
    if (maxCalls <= 0) continue;
    console.log(`Running ${taskType}: up to ${maxCalls} call(s) this tick.`);
    // Deliberately sequential — see the same rationale in triage_suggestions.ts.
    // eslint-disable-next-line no-await-in-loop
    await runner(maxCalls);
  }
}

function callsTodayFromLog(taskType: string): number {
  const today = new Date().toISOString().slice(0, 10);
  // Counts "generate" calls specifically — each candidate attempted costs exactly one, regardless
  // of whether self-critique also ran a "critique" call or a retry, so this is the right proxy for
  // "how many candidates were attempted today" against maxCallsPerDay.
  return readContextUsageLog()
    .filter(entry => entry.taskType === taskType && entry.callKind === "generate"
      && entry.timestamp.slice(0, 10) === today)
    .length;
}

async function main(): Promise<void> {
  await runScheduledTick({
    config: readBudgetConfig(),
    callsToday: callsTodayFromLog,
    runners: TASK_RUNNERS,
  });
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exitCode = 1;
  });
}
