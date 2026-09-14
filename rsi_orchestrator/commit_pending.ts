import {execFile} from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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

const MANAGED_PATHS = [
  "precomputed/ai_additions",
  "precomputed/rsi_state/generation_records",
  "precomputed/rsi_state/context_usage_log",
  "precomputed/rsi_state/context_usage_log.jsonl",
];

export interface CommitPendingDeps {
  // Anything staged/unstaged under the managed paths right now, or "" if none.
  gitStatusPorcelain: () => Promise<string>;
  // The open PR (if any) already on BRANCH, so a run adds to it instead of opening a new one.
  findOpenPr: () => Promise<{number: number} | undefined>;
  createWorktree: (targetRef: string) => Promise<string>;
  removeWorktree: (worktreeDir: string) => Promise<void>;
  mergeAndWriteFiles: (worktreeDir: string, paths: string[]) => Promise<void>;
  commitPendingState: (worktreeDir: string, message: string) => Promise<boolean>;
  push: (worktreeDir: string, branch: string) => Promise<void>;
  openPr: (branch: string, title: string, body: string) => Promise<void>;
}

/** Parses `git status --porcelain`'s path column, including its quoting of unusual paths. */
export function parseStatusPaths(statusOut: string): string[] {
  return statusOut
    .split("\n")
    .map(line => line.slice(3).trim())
    .filter(Boolean)
    .map(p => (p.startsWith("\"") ? JSON.parse(p) as string : p));
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
  pathStr: string, remoteRaw: string | undefined, localRaw: string,
): string {
  if (pathStr.endsWith(".jsonl")) {
    const remoteLines = remoteRaw ? remoteRaw.split("\n").filter(Boolean) : [];
    const remoteSet = new Set(remoteLines);
    const newLocalLines = localRaw.split("\n").filter(line => line && !remoteSet.has(line));
    return [...remoteLines, ...newLocalLines].map(line => `${line}\n`).join("");
  }
  const remoteJson = remoteRaw ? JSON.parse(remoteRaw) as Record<string, unknown> : {};
  const localJson = JSON.parse(localRaw) as Record<string, unknown>;
  return `${JSON.stringify({...remoteJson, ...localJson}, undefined, 2)}\n`;
}

/**
 * Commits + pushes any locally-modified files under the managed paths (status: "pending"
 * candidates a task type just wrote, plus its generation-record/context-usage audit trail) onto
 * a standing PR, opening one if none is currently open. Uses a dedicated temporary worktree
 * so the calling working tree is never disrupted and parallel workers can commit without branch
 * collisions. No-ops if nothing changed this run.
 */
export async function commitAndPushPendingCandidates(
  message: string,
  deps: CommitPendingDeps,
): Promise<void> {
  const status = await deps.gitStatusPorcelain();
  if (!status.trim()) return;

  const openPr = await deps.findOpenPr();
  const targetRef = openPr ? BRANCH : BASE_BRANCH;
  const worktreeDir = await deps.createWorktree(targetRef);
  try {
    const paths = parseStatusPaths(status);
    await deps.mergeAndWriteFiles(worktreeDir, paths);
    const committed = await deps.commitPendingState(worktreeDir, message);
    if (committed) {
      await deps.push(worktreeDir, BRANCH);

      if (!openPr) {
        await deps.openPr(
          BRANCH,
          "RSI: new pending translation candidates",
          "Automated batch of newly-generated `status: \"pending\"` translation candidates. Review "
          + "them on their live page (once deployed) with `?rsiReviewKey=<secret>` — this PR itself "
          + "isn't the review surface, just what makes the candidates visible at all.",
        );
      }
    }
  } finally {
    await deps.removeWorktree(worktreeDir);
  }
}

async function runSubcommand(
  file: string,
  args: string[],
  debug = false,
): Promise<{stdout: string; stderr: string}> {
  if (debug) {
    // eslint-disable-next-line no-console
    console.log(`  [subcommand] ${file} ${args.join(" ")}`);
  }
  return execFileAsync(file, args);
}

async function gitStatusPorcelainViaCli(debug = false): Promise<string> {
  const {stdout} = await runSubcommand(
    // --untracked-files=all: without it, git collapses an entirely-untracked directory into a
    // single directory-path entry instead of listing the files inside it. Doesn't bite today
    // (both managed directories always have other already-tracked files in them), but it's the
    // difference between "correct" and "correct by accident of existing repo state."
    "git", ["status", "--porcelain", "--untracked-files=all", "--", ...MANAGED_PATHS], debug);
  return stdout;
}

async function findOpenPrViaGh(debug = false): Promise<{number: number} | undefined> {
  const {stdout} = await runSubcommand("gh", [
    "pr", "list", "--repo", REPO, "--head", BRANCH, "--state", "open", "--json", "number",
  ], debug);
  const prs = JSON.parse(stdout) as Array<{number: number}>;
  return prs[0];
}

async function mergeAndWriteFilesViaCli(worktreeDir: string, paths: string[]): Promise<void> {
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const localRaw = fs.readFileSync(p, "utf-8");
    const destPath = path.join(worktreeDir, p);
    const remoteRaw = fs.existsSync(destPath) ? fs.readFileSync(destPath, "utf-8") : undefined;
    const dir = path.dirname(destPath);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(destPath, mergeFileContent(p, remoteRaw, localRaw));
  }
}

export function makeRealCommitPendingDeps(options?: {debug?: boolean}): CommitPendingDeps {
  const debug = options?.debug ?? false;
  return {
    gitStatusPorcelain: () => gitStatusPorcelainViaCli(debug),
    findOpenPr: () => findOpenPrViaGh(debug),
    createWorktree: async targetRef => {
      await runSubcommand("git", ["fetch", "origin", targetRef], debug);
      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "rsi-commit-worktree-"));
      await runSubcommand(
        "git", ["worktree", "add", "--detach", worktreeDir, `origin/${targetRef}`], debug);
      return worktreeDir;
    },
    removeWorktree: async worktreeDir => {
      try {
        await runSubcommand("git", ["worktree", "remove", "--force", worktreeDir], debug);
      } finally {
        fs.rmSync(worktreeDir, {recursive: true, force: true});
      }
    },
    mergeAndWriteFiles: (worktreeDir, paths) => mergeAndWriteFilesViaCli(worktreeDir, paths),
    commitPendingState: async (worktreeDir, message) => {
      await runSubcommand("git", ["-C", worktreeDir, "add", ...MANAGED_PATHS], debug);
      const {stdout: statusOut} = await runSubcommand(
        "git", ["-C", worktreeDir, "status", "--porcelain", "--", ...MANAGED_PATHS], debug);
      if (!statusOut.trim()) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log("  [commit] nothing to commit, working tree clean.");
        }
        return false;
      }
      await runSubcommand(
        "git", ["-C", worktreeDir, "commit", "--no-verify", "-m", message], debug);
      return true;
    },
    push: async (worktreeDir, branch) => {
      try {
        await runSubcommand(
          "git", ["-C", worktreeDir, "push", "-u", "origin", `HEAD:refs/heads/${branch}`], debug);
      } catch {
        // Concurrent push race: fetch latest origin/branch, reset worktree to it, re-merge, and
        // push again.
        if (debug) {
          // eslint-disable-next-line no-console
          console.log(
            `  [push] initial push failed, retrying after fetching latest origin/${branch}...`);
        }
        await runSubcommand("git", ["fetch", "origin", branch], debug);
        await runSubcommand(
          "git", ["-C", worktreeDir, "reset", "--hard", `origin/${branch}`], debug);
        const {stdout: statusOut} = await runSubcommand(
          "git", ["status", "--porcelain", "--untracked-files=all", "--", ...MANAGED_PATHS], debug);
        const paths = parseStatusPaths(statusOut);
        await mergeAndWriteFilesViaCli(worktreeDir, paths);
        await runSubcommand("git", ["-C", worktreeDir, "add", ...MANAGED_PATHS], debug);
        await runSubcommand(
          "git",
          ["-C", worktreeDir, "commit", "--no-verify", "-m", "Merge concurrent candidate changes"],
          debug);
        await runSubcommand(
          "git", ["-C", worktreeDir, "push", "-u", "origin", `HEAD:refs/heads/${branch}`], debug);
      }
    },
    openPr: async (branch, title, body) => {
      await runSubcommand("gh", [
        "pr", "create", "--repo", REPO, "--base", BASE_BRANCH, "--head", branch,
        "--title", title, "--body", body,
      ], debug);
    },
  };
}

export const realCommitPendingDeps: CommitPendingDeps = makeRealCommitPendingDeps();
