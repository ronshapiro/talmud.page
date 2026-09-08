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

// Everything a task-type run can write locally: ai_additions/ (the reviewable candidates
// themselves — this is what makes a run's output visible on the live site at all) and rsi_state/
// (generation records + the context-usage log — the provenance/audit trail, read by
// isFreshTranslation()'s staleness check).
//
// Both MUST be committed together, on every run, not just ai_additions/. Committing only
// ai_additions/ and leaving rsi_state/ dangling uncommitted was the original design — it broke
// for two reasons hit for real: (1) a later run's branch switch fails outright once rsi_state/
// has local modifications git would discard (the context-usage log used to be one shared
// context_usage_log.jsonl file that every run touched — since split into one file per (task
// type, page) under context_usage_log/ specifically to shrink how often two runs collide on the
// same file at all, though same-page reruns still can, hence the merge logic below), and (2)
// worse, if the audit trail is ever committed *without* the matching ai_additions content (e.g.
// by hand, after a run that generated content but failed to commit it), isFreshTranslation()
// reads the generation record and wrongly reports those refs as already translated —
// permanently masking lost work from ever being regenerated, since nothing rechecks that
// ai_additions actually has the content the record claims exists.
const MANAGED_PATHS = ["precomputed/ai_additions", "precomputed/rsi_state"];

export interface CommitPendingDeps {
  // Anything staged/unstaged under the managed paths right now, or "" if none.
  gitStatusPorcelain: () => Promise<string>;
  // The open PR (if any) already on BRANCH, so a run adds to it instead of opening a new one.
  findOpenPr: () => Promise<{number: number} | undefined>;
  checkoutNewBranch: (branch: string, from: string) => Promise<void>;
  // Switches to BRANCH and merges any local pending edits into whatever's already committed
  // there for the same paths — needed because a not-yet-merged earlier run may have already
  // committed a different version of the same file (most often the same page's ai_additions
  // entry or context-usage log, from an earlier not-yet-merged run against that same page). A
  // plain `git checkout` refuses to overwrite that local, uncommitted work rather than silently
  // discarding it (hit this for real).
  mergeLocalChangesOnto: (branch: string) => Promise<void>;
  commitPendingState: (message: string) => Promise<void>;
  push: (branch: string) => Promise<void>;
  openPr: (branch: string, title: string, body: string) => Promise<void>;
  checkout: (branch: string) => Promise<void>;
}

/**
 * Commits + pushes any locally-modified files under the managed paths (status: "pending"
 * candidates a task type just wrote, plus its generation-record/context-usage audit trail) onto
 * a standing PR, opening one if none is currently open. Without this, a generated candidate sits
 * on local disk only — not actually reviewable on the live site until someone commits and pushes
 * it by hand (a real gap the RSI Phase 3 plan flagged and didn't close). No-ops if nothing
 * changed this run.
 */
export async function commitAndPushPendingCandidates(
  message: string,
  deps: CommitPendingDeps,
): Promise<void> {
  const status = await deps.gitStatusPorcelain();
  if (!status.trim()) return;

  const openPr = await deps.findOpenPr();
  if (openPr) {
    await deps.mergeLocalChangesOnto(BRANCH);
  } else {
    await deps.checkoutNewBranch(BRANCH, BASE_BRANCH);
  }

  await deps.commitPendingState(message);
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
    // (both managed directories always have other already-tracked files in them), but it's the
    // difference between "correct" and "correct by accident of existing repo state."
    "git", ["status", "--porcelain", "--untracked-files=all", "--", ...MANAGED_PATHS]);
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

/**
 * Merges one file's local content with what's already committed on the target branch (or
 * undefined if the target branch doesn't have this file at all). `.jsonl` files (the
 * append-only context-usage log) merge by line union — keep the remote's lines, then append any
 * local line not already present. Everything else is treated as a ref-keyed JSON object
 * (ai_additions entries, generation records) and merges by key union, local winning on a
 * duplicate ref — harmless, since a duplicate is just a re-attempt at the same source.
 */
export function mergeFileContent(
  path: string, remoteRaw: string | undefined, localRaw: string,
): string {
  if (path.endsWith(".jsonl")) {
    const remoteLines = remoteRaw ? remoteRaw.split("\n").filter(Boolean) : [];
    const remoteSet = new Set(remoteLines);
    const newLocalLines = localRaw.split("\n").filter(line => line && !remoteSet.has(line));
    return [...remoteLines, ...newLocalLines].map(line => `${line}\n`).join("");
  }
  const remoteJson = remoteRaw ? JSON.parse(remoteRaw) as Record<string, unknown> : {};
  const localJson = JSON.parse(localRaw) as Record<string, unknown>;
  return `${JSON.stringify({...remoteJson, ...localJson}, undefined, 2)}\n`;
}

async function isTrackedOnCurrentBranch(path: string): Promise<boolean> {
  const {stdout} = await execFileAsync("git", ["ls-files", "--", path]);
  return stdout.trim().length > 0;
}

async function mergeLocalChangesOntoViaCli(branch: string): Promise<void> {
  const {stdout: statusOut} = await execFileAsync(
    "git", ["status", "--porcelain", "--untracked-files=all", "--", ...MANAGED_PATHS]);
  const paths = parseStatusPaths(statusOut);

  const localContentByPath = new Map<string, string>();
  for (const path of paths) {
    localContentByPath.set(path, fs.readFileSync(path, "utf-8"));
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

  for (const [path, localRaw] of localContentByPath) {
    const remoteRaw = fs.existsSync(path) ? fs.readFileSync(path, "utf-8") : undefined;
    const dir = path.slice(0, path.lastIndexOf("/"));
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path, mergeFileContent(path, remoteRaw, localRaw));
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
  mergeLocalChangesOnto: mergeLocalChangesOntoViaCli,
  commitPendingState: async message => {
    await execFileAsync("git", ["add", ...MANAGED_PATHS]);
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
