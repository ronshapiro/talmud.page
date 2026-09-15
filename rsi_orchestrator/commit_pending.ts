import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);
const REPO = "ronshapiro/talmud.page";
const BASE_BRANCH = "base";

const MANAGED_PATHS = [
  "precomputed/ai_additions",
  "precomputed/rsi_state/generation_records",
  "precomputed/rsi_state/context_usage_log",
  "precomputed/rsi_state/context_usage_log.jsonl",
];

export interface CommitPendingDeps {
  // Anything staged/unstaged under the managed paths right now, or "" if none.
  gitStatusPorcelain: () => Promise<string>;
  // Current git branch name.
  currentBranch: () => Promise<string>;
  // The open PR (if any) already on this branch.
  findOpenPr: (branch: string) => Promise<{number: number} | undefined>;
  commitPendingState: (message: string) => Promise<boolean>;
  push: () => Promise<void>;
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
 * candidates a task type just wrote, plus its generation-record/context-usage audit trail)
 * directly in the current worktree onto its branch, opening a PR if none is currently open.
 * Assumes worktrees and branches are externally managed per translation task (Option A),
 * so multiple tasks in parallel operate in separate worktrees without collisions.
 * No-ops if nothing changed this run.
 */
export async function commitAndPushPendingCandidates(
  message: string,
  deps: CommitPendingDeps,
): Promise<void> {
  const status = await deps.gitStatusPorcelain();
  if (!status.trim()) return;

  const branch = await deps.currentBranch();
  if (branch === BASE_BRANCH || branch === "HEAD") {
    throw new Error(
      `Cannot commit pending candidates directly to "${branch}". `
      + "Run translation in a dedicated feature branch or worktree.");
  }

  const committed = await deps.commitPendingState(message);
  if (!committed) return;

  await deps.push();

  const openPr = await deps.findOpenPr(branch);
  if (!openPr) {
    await deps.openPr(
      branch,
      message,
      "Automated batch of newly-generated `status: \"pending\"` translation candidates. Review "
      + "them on their live page (once deployed) with `?rsiReviewKey=<secret>` — this PR itself "
      + "isn't the review surface, just what makes the candidates visible at all.",
    );
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
    "git", ["status", "--porcelain", "--untracked-files=all", "--", ...MANAGED_PATHS], debug);
  return stdout;
}

async function currentBranchViaCli(debug = false): Promise<string> {
  const {stdout} = await runSubcommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], debug);
  return stdout.trim();
}

async function findOpenPrViaGh(
  branch: string, debug = false,
): Promise<{number: number} | undefined> {
  const {stdout} = await runSubcommand("gh", [
    "pr", "list", "--repo", REPO, "--head", branch, "--state", "open", "--json", "number",
  ], debug);
  const prs = JSON.parse(stdout) as Array<{number: number}>;
  return prs[0];
}

async function commitPendingStateViaCli(message: string, debug = false): Promise<boolean> {
  await runSubcommand("git", ["add", ...MANAGED_PATHS], debug);
  const {stdout: statusOut} = await runSubcommand(
    "git", ["status", "--porcelain", "--", ...MANAGED_PATHS], debug);
  if (!statusOut.trim()) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log("  [commit] nothing to commit, working tree clean.");
    }
    return false;
  }
  await runSubcommand("git", ["commit", "--no-verify", "-m", message], debug);
  return true;
}

async function pushViaCli(debug = false): Promise<void> {
  await runSubcommand("git", ["push", "-u", "origin", "HEAD"], debug);
}

async function openPrViaGh(
  branch: string, title: string, body: string, debug = false,
): Promise<void> {
  await runSubcommand("gh", [
    "pr", "create", "--repo", REPO, "--base", BASE_BRANCH, "--head", branch,
    "--title", title, "--body", body,
  ], debug);
}

export function makeRealCommitPendingDeps(options?: {debug?: boolean}): CommitPendingDeps {
  const debug = options?.debug ?? false;
  return {
    gitStatusPorcelain: () => gitStatusPorcelainViaCli(debug),
    currentBranch: () => currentBranchViaCli(debug),
    findOpenPr: branch => findOpenPrViaGh(branch, debug),
    commitPendingState: message => commitPendingStateViaCli(message, debug),
    push: () => pushViaCli(debug),
    openPr: (branch, title, body) => openPrViaGh(branch, title, body, debug),
  };
}

export const realCommitPendingDeps: CommitPendingDeps = makeRealCommitPendingDeps();
