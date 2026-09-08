import {execFile} from "child_process";
import * as fs from "fs";
import {promisify} from "util";

const execFileAsync = promisify(execFile);
const REPO = "ronshapiro/talmud.page";
const BASE_BRANCH = "base";
// One fixed branch, reused across runs, rather than a timestamped one per run — unlike
// rsi_review_pr.ts's per-reviewer batching (which has to handle concurrent browser reviewers),
// this only ever runs sequentially on one machine, so there's no concurrent-writer case to guard
// against by scoping per-caller.
//
// A plain (non-force) push relies on this branch never colliding with a stale ref of the same
// name once its PR merges — true only because the repo has "automatically delete head branches"
// enabled. Without that setting, a squash-merged PR leaves its branch behind, and the next run's
// freshly re-created branch (built from base, which now has an equivalent-but-different commit)
// would be a non-fast-forward push. Hit this for real once; fix is the repo setting, not a
// --force here — a failed push should fail loudly, not be silently forced past.
const BRANCH = "rsi-pending-candidates";

export interface CommitPendingDeps {
  // Anything staged/unstaged under precomputed/ai_additions/ right now, or "" if none.
  gitStatusPorcelain: () => Promise<string>;
  // The open PR (if any) already on BRANCH, so a run adds to it instead of opening a new one.
  findOpenPr: () => Promise<{number: number} | undefined>;
  checkoutNewBranch: (branch: string, from: string) => Promise<void>;
  // Switches to BRANCH and merges any local pending ai_additions/ edits into whatever's already
  // committed there for the same paths (JSON key union, local wins on a duplicate ref) — needed
  // because a not-yet-merged earlier run may have already committed a different version of the
  // same page's file. A plain `git checkout` refuses to overwrite that local, uncommitted work
  // rather than silently discarding it (hit this for real: two separate runs against the same
  // page, the first still an unmerged PR when the second ran).
  mergeLocalAiAdditionsOnto: (branch: string) => Promise<void>;
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
    await deps.mergeLocalAiAdditionsOnto(BRANCH);
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
    // --untracked-files=all: without it, git collapses an entirely-untracked directory into a
    // single directory-path entry instead of listing the files inside it. Doesn't bite today
    // (this directory always has other already-tracked pages in it), but it's the difference
    // between "correct" and "correct by accident of existing repo state."
    "git", ["status", "--porcelain", "--untracked-files=all", "--", "precomputed/ai_additions"]);
  return stdout;
}

async function findOpenPrViaGh(): Promise<{number: number} | undefined> {
  const {stdout} = await execFileAsync("gh", [
    "pr", "list", "--repo", REPO, "--head", BRANCH, "--state", "open", "--json", "number",
  ]);
  const prs = JSON.parse(stdout) as Array<{number: number}>;
  return prs[0];
}

/** Parses `git status --porcelain`'s path column, including its quoting of unusual paths. */
export function parseStatusPaths(statusOut: string): string[] {
  return statusOut
    .split("\n")
    .map(line => line.slice(3).trim())
    .filter(Boolean)
    .map(path => (path.startsWith("\"") ? JSON.parse(path) as string : path));
}

async function isTrackedOnCurrentBranch(path: string): Promise<boolean> {
  const {stdout} = await execFileAsync("git", ["ls-files", "--", path]);
  return stdout.trim().length > 0;
}

async function mergeLocalAiAdditionsOntoViaCli(branch: string): Promise<void> {
  const {stdout: statusOut} = await execFileAsync(
    // --untracked-files=all: without it, git collapses an entirely-untracked directory into a
    // single directory-path entry instead of listing the files inside it. Doesn't bite today
    // (this directory always has other already-tracked pages in it), but it's the difference
    // between "correct" and "correct by accident of existing repo state."
    "git", ["status", "--porcelain", "--untracked-files=all", "--", "precomputed/ai_additions"]);
  const paths = parseStatusPaths(statusOut);

  const localByPath = new Map<string, Record<string, unknown>>();
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    localByPath.set(path, JSON.parse(fs.readFileSync(path, "utf-8")) as Record<string, unknown>);
  }

  // Clean the working tree for just these paths so the branch switch below doesn't refuse —
  // their content is already captured above and gets written back after switching.
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    if (await isTrackedOnCurrentBranch(path)) {
      // eslint-disable-next-line no-await-in-loop
      await execFileAsync("git", ["checkout", "--", path]);
    } else {
      fs.unlinkSync(path);
    }
  }

  await execFileAsync("git", ["fetch", "origin", branch]);
  await execFileAsync("git", ["checkout", "-B", branch, `origin/${branch}`]);

  for (const [path, localJson] of localByPath) {
    const remoteJson = fs.existsSync(path)
      ? JSON.parse(fs.readFileSync(path, "utf-8")) as Record<string, unknown>
      : {};
    fs.writeFileSync(path, `${JSON.stringify({...remoteJson, ...localJson}, undefined, 2)}\n`);
  }
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
  mergeLocalAiAdditionsOnto: mergeLocalAiAdditionsOntoViaCli,
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
