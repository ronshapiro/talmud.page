import {execFile} from "child_process";
import {promisify} from "util";
import {isAlreadyTriaged, markTriaged} from "../precomputed/rsi_state/triage_log";
import {runHeadlessClaude} from "./headless_claude";

const execFileAsync = promisify(execFile);
const REPO = "ronshapiro/talmud.page";

export interface Suggestion {
  number: number;
  title: string;
  body: string;
}

export interface TriageDeps {
  listOpenSuggestions: () => Promise<Suggestion[]>;
  commentOnIssue: (issueNumber: number, comment: string) => Promise<void>;
  assessFeasibility: (suggestion: Suggestion) => Promise<string>;
  isAlreadyTriaged: (issueNumber: number) => boolean;
  markTriaged: (issueNumber: number) => void;
}

/**
 * Reads open rsi-suggestion issues, has Claude assess each one's feasibility against the current
 * codebase, and posts that assessment as an issue comment. Deliberately stops there for now: it
 * does not scaffold a new task type or open a PR. That's a Phase 2+ capability once task-type
 * configs actually exist to scaffold against (see RecursiveSelfImprovingAgentPlan.md) — this is
 * the Phase 1 skeleton, and it only reads code and comments on issues, so it's safe to run
 * unattended before that exists.
 */
export async function triageOpenSuggestions(deps: TriageDeps): Promise<void> {
  const suggestions = await deps.listOpenSuggestions();
  for (const suggestion of suggestions) {
    if (deps.isAlreadyTriaged(suggestion.number)) continue;
    // Deliberately sequential, not Promise.all — each iteration shells out to a real `claude -p`
    // process, and running many at once would fight over the same subscription's rate limits.
    // eslint-disable-next-line no-await-in-loop
    const assessment = await deps.assessFeasibility(suggestion);
    // eslint-disable-next-line no-await-in-loop
    await deps.commentOnIssue(suggestion.number, assessment);
    deps.markTriaged(suggestion.number);
  }
}

async function listOpenSuggestionsViaGh(): Promise<Suggestion[]> {
  const {stdout} = await execFileAsync("gh", [
    "issue", "list",
    "--repo", REPO,
    "--label", "rsi-suggestion",
    "--state", "open",
    "--json", "number,title,body",
  ]);
  return JSON.parse(stdout) as Suggestion[];
}

async function commentOnIssueViaGh(issueNumber: number, comment: string): Promise<void> {
  await execFileAsync("gh", [
    "issue", "comment", String(issueNumber),
    "--repo", REPO,
    "--body", comment,
  ]);
}

function feasibilityPrompt(suggestion: Suggestion): string {
  return [
    "You're triaging a feature suggestion for the talmud.page recursive self-improving content",
    "agent (see RecursiveSelfImprovingAgentPlan.md in this repo for the project's architecture",
    "and existing task-type list).",
    "",
    `Suggestion title: ${suggestion.title}`,
    `Suggestion body: ${suggestion.body}`,
    "",
    "Assess in a few sentences: is this a good fit for a new automated task type? Does it",
    "overlap with an existing task type in the plan doc? What data would it need that Sefaria",
    "doesn't already provide, if any? Don't implement anything — this is an assessment only.",
  ].join("\n");
}

async function main(): Promise<void> {
  await triageOpenSuggestions({
    listOpenSuggestions: listOpenSuggestionsViaGh,
    commentOnIssue: commentOnIssueViaGh,
    assessFeasibility: suggestion => runHeadlessClaude(feasibilityPrompt(suggestion)),
    isAlreadyTriaged,
    markTriaged,
  });
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exitCode = 1;
  });
}
