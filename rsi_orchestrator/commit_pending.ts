import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);
const REPO = "ronshapiro/talmud.page";
const BASE_BRANCH = "base";
// One fixed branch, reused across runs, rather than a timestamped one per run — unlike
// rsi_review_pr.ts's per-reviewer batching (which has to handle concurrent browser reviewers),
// this only ever runs sequentially on one machine, so there's no concurrent-writer case to guard
// against by scoping per-caller.
const BRANCH = "rsi-pending-candidates";

export interface CommitPendingDeps {
  // Anything staged/unstaged under precomputed/ai_additions/ right now, or "" if none.
  gitStatusPorcelain: () => Promise<string>;
  // The open PR (if any) already on BRANCH, so a run adds to it instead of opening a new one.
  findOpenPr: () => Promise<{number: number} | undefined>;
  checkoutNewBranch: (branch: string, from: string) => Promise<void>;
  checkoutExistingBranch: (branch: string) => Promise<void>;
  commitAiAdditions: (message: string) => Promise<void>;
  push: (branch: string) => Promise<void>;
  openPr: (branch: string, title: string, body: string) => Promise<void>;
  checkout: (branch: string) => Promise<void>;
}

/**
 * Commits + pushes any locally-modified precomputed/ai_additions/ files (status: "pending"
 * candidates a task type just wrote) onto a standing PR, opening one if none is currently open.
 * Without this, a generated candidate sits on local disk only — not actually reviewable on the
 * live site until someone commits and pushes it by hand (a real gap the RSI Phase 3 plan flagged
 * and didn't close). No-ops if nothing changed this run.
 */
export async function commitAndPushPendingCandidates(
  message: string,
  deps: CommitPendingDeps,
): Promise<void> {
  const status = await deps.gitStatusPorcelain();
  if (!status.trim()) return;

  const openPr = await deps.findOpenPr();
  if (openPr) {
    await deps.checkoutExistingBranch(BRANCH);
  } else {
    await deps.checkoutNewBranch(BRANCH, BASE_BRANCH);
  }

  await deps.commitAiAdditions(message);
  await deps.push(BRANCH);

  if (!openPr) {
    await deps.openPr(
      BRANCH,
      "RSI: new pending translation candidates",
      "Automated batch of newly-generated `status: \"pending\"` translation candidates. Review "
      + "them on their live page (once deployed) with `?rsiReviewKey=<secret>` — this PR itself "
      + "isn't the review surface, just what makes the candidates visible at all.",
    );
  }

  await deps.checkout(BASE_BRANCH);
}

async function gitStatusPorcelainViaCli(): Promise<string> {
  const {stdout} = await execFileAsync(
    "git", ["status", "--porcelain", "--", "precomputed/ai_additions"]);
  return stdout;
}

async function findOpenPrViaGh(): Promise<{number: number} | undefined> {
  const {stdout} = await execFileAsync("gh", [
    "pr", "list", "--repo", REPO, "--head", BRANCH, "--state", "open", "--json", "number",
  ]);
  const prs = JSON.parse(stdout) as Array<{number: number}>;
  return prs[0];
}

export const realCommitPendingDeps: CommitPendingDeps = {
  gitStatusPorcelain: gitStatusPorcelainViaCli,
  findOpenPr: findOpenPrViaGh,
  // `from` (BASE_BRANCH, i.e. "base") is a local branch name that can go stale across sessions —
  // fetch and branch from origin's ref, not whatever the local branch happens to point at.
  checkoutNewBranch: async (branch, from) => {
    await execFileAsync("git", ["fetch", "origin", from]);
    await execFileAsync("git", ["checkout", "-B", branch, `origin/${from}`]);
  },
  checkoutExistingBranch: async branch => {
    await execFileAsync("git", ["fetch", "origin", branch]);
    await execFileAsync("git", ["checkout", "-B", branch, `origin/${branch}`]);
  },
  commitAiAdditions: async message => {
    await execFileAsync("git", ["add", "precomputed/ai_additions"]);
    await execFileAsync("git", ["commit", "-m", message]);
  },
  push: async branch => {
    await execFileAsync("git", ["push", "-u", "origin", branch]);
  },
  openPr: async (branch, title, body) => {
    await execFileAsync("gh", [
      "pr", "create", "--repo", REPO, "--base", BASE_BRANCH, "--head", branch,
      "--title", title, "--body", body,
    ]);
  },
  // Same staleness concern as checkoutNewBranch — land back on a local `base` that actually
  // matches origin, not whatever it was left at.
  checkout: async branch => {
    await execFileAsync("git", ["fetch", "origin", branch]);
    await execFileAsync("git", ["checkout", "-B", branch, `origin/${branch}`]);
  },
};
