import {execFile} from "child_process";
import {promisify} from "util";
import {books} from "../books";
import {mergeRefs} from "../ref_merging";
import {splitOnBookName} from "../refs";

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
  gitStatusPorcelain: () => Promise<string>;
  currentBranch: () => Promise<string>;
  findOpenPr: (branch: string) => Promise<{number: number; title?: string} | undefined>;
  commitPendingState: (message: string) => Promise<boolean>;
  push: () => Promise<void>;
  openPr: (branch: string, title: string, body: string) => Promise<number | undefined | void>;
  updatePrTitle?: (prNumber: number, title: string) => Promise<void>;
  addPrComment?: (prNumber: number, comment: string) => Promise<void>;
  getCurrentHeadSha?: () => Promise<string>;
  getDiffStats?: (fromRef: string, toRef: string) => Promise<{
    diff?: string;
    numstat?: string;
    nameStatus: string;
  }>;
  getBranchChangedPaths?: (baseBranch: string, branch: string) => Promise<string[]>;
}

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

export function extractPagesFromPaths(paths: string[]): string[] {
  const pages = new Set<string>();
  for (const p of paths) {
    let candidate: string | undefined;
    const aiMatch = p.match(/^precomputed\/ai_additions\/(.+)\.json$/);
    if (aiMatch) {
      [, candidate] = aiMatch;
    } else {
      const genMatch = p.match(/^precomputed\/rsi_state\/generation_records\/[^/]+\/(.+)\.json$/);
      if (genMatch) {
        [, candidate] = genMatch;
      } else {
        const logMatch = p.match(/^precomputed\/rsi_state\/context_usage_log\/[^/]+\/(.+)\.jsonl$/);
        if (logMatch) {
          [, candidate] = logMatch;
        }
      }
    }
    if (!candidate || !candidate.includes(" ")) continue;
    const [bookName] = splitOnBookName(candidate);
    if (books.byCanonicalName[bookName]) {
      pages.add(candidate);
    }
  }
  return Array.from(pages);
}

export function formatPrTitle(task: string, backend: string, pages: string[]): string {
  const prefix = `${task} | ${backend}`;
  if (pages.length === 0) {
    return prefix;
  }
  const mergedPages = Array.from(mergeRefs(pages).keys());
  const pagesList = mergedPages.join(", ");
  if (pagesList.length > 150) {
    const truncated = mergedPages.slice(0, 5).join(", ");
    return `${prefix}: ${truncated} (+${mergedPages.length - 5} more)`;
  }
  return `${prefix}: ${pagesList}`;
}

export interface FileEditStat {
  path: string;
  mode: "add" | "delete" | "modify";
  addedLines: number;
  modifiedLines: number;
  deletedLines: number;
}

export function parseDiffStats(diffOrNumstatOut: string, nameStatusOut: string): FileEditStat[] {
  const modeByPath = new Map<string, "add" | "delete" | "modify">();
  for (const line of nameStatusOut.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("\t");
    const statusCode = parts[0].charAt(0).toUpperCase();
    let mode: "add" | "delete" | "modify" = "modify";
    if (statusCode === "A") mode = "add";
    else if (statusCode === "D") mode = "delete";
    else if (statusCode === "M" || statusCode === "R") mode = "modify";

    let rawPath = parts[parts.length - 1].trim();
    if (rawPath.startsWith("\"")) {
      rawPath = JSON.parse(rawPath) as string;
    }
    modeByPath.set(rawPath, mode);
  }

  type LineStats = {addedLines: number; modifiedLines: number; deletedLines: number};
  const statsByPath = new Map<string, LineStats>();
  const isDiff = diffOrNumstatOut.includes("@@ ") || diffOrNumstatOut.includes("diff --git");

  if (isDiff) {
    let currentFile: string | undefined;
    for (const line of diffOrNumstatOut.split("\n")) {
      if (line.startsWith("--- ")) {
        const raw = line.slice(4).trim();
        if (raw !== "/dev/null") {
          currentFile = raw.startsWith("\"") ? (JSON.parse(raw) as string).slice(2) : raw.slice(2);
        }
      } else if (line.startsWith("+++ ")) {
        const raw = line.slice(4).trim();
        if (raw !== "/dev/null") {
          currentFile = raw.startsWith("\"") ? (JSON.parse(raw) as string).slice(2) : raw.slice(2);
        }
      } else if (line.startsWith("@@ ") && currentFile) {
        const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match) {
          if (!statsByPath.has(currentFile)) {
            statsByPath.set(currentFile, {addedLines: 0, modifiedLines: 0, deletedLines: 0});
          }
          const del = match[2] === undefined ? 1 : parseInt(match[2], 10);
          const add = match[4] === undefined ? 1 : parseInt(match[4], 10);
          const mod = Math.min(del, add);
          const stat = statsByPath.get(currentFile)!;
          stat.modifiedLines += mod;
          stat.addedLines += (add - mod);
          stat.deletedLines += (del - mod);
        }
      }
    }
  } else {
    for (const line of diffOrNumstatOut.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split("\t");
      if (parts.length < 3) continue;
      const addedRaw = parts[0].trim();
      const deletedRaw = parts[1].trim();
      let rawPath = parts.slice(2).join("\t").trim();
      if (rawPath.startsWith("\"")) {
        rawPath = JSON.parse(rawPath) as string;
      }
      const addedLines = addedRaw === "-" ? 0 : parseInt(addedRaw, 10) || 0;
      const deletedLines = deletedRaw === "-" ? 0 : parseInt(deletedRaw, 10) || 0;
      statsByPath.set(rawPath, {addedLines, modifiedLines: 0, deletedLines});
    }
  }

  const stats: FileEditStat[] = [];
  const seenPaths = new Set<string>();

  for (const [p, lineStats] of statsByPath.entries()) {
    seenPaths.add(p);
    const mode = modeByPath.get(p) ?? "modify";
    stats.push({
      path: p,
      mode,
      addedLines: lineStats.addedLines,
      modifiedLines: lineStats.modifiedLines,
      deletedLines: lineStats.deletedLines,
    });
  }

  for (const [p, mode] of modeByPath.entries()) {
    if (!seenPaths.has(p)) {
      stats.push({path: p, mode, addedLines: 0, modifiedLines: 0, deletedLines: 0});
    }
  }

  stats.sort((a, b) => a.path.localeCompare(b.path));
  return stats;
}

export function formatDiffStatsTable(stats: FileEditStat[]): string {
  if (stats.length === 0) return "No file changes in this batch.";

  const rows: string[] = [];
  rows.push("### File Changes\n");
  rows.push("| File | Mode | Added Lines | Modified Lines | Deleted Lines |");
  rows.push("| :--- | :---: | ---: | ---: | ---: |");

  let totalAdded = 0;
  let totalModified = 0;
  let totalDeleted = 0;

  for (const stat of stats) {
    totalAdded += stat.addedLines;
    totalModified += stat.modifiedLines;
    totalDeleted += stat.deletedLines;
    rows.push(
      `| \`${stat.path}\` | ${stat.mode} | +${stat.addedLines} | ~${stat.modifiedLines} | -${stat.deletedLines} |`,
    );
  }

  rows.push(`| **Total** | | **+${totalAdded}** | **~${totalModified}** | **-${totalDeleted}** |`);

  return rows.join("\n");
}

export interface CommitPendingOptions {
  task?: string;
  backend?: string;
  pages?: string[];
  message?: string;
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
  optionsOrMessage: string | CommitPendingOptions,
  deps: CommitPendingDeps,
): Promise<void> {
  const options: CommitPendingOptions = typeof optionsOrMessage === "string"
    ? {message: optionsOrMessage}
    : optionsOrMessage;

  const status = await deps.gitStatusPorcelain();
  if (!status.trim()) return;

  const branch = await deps.currentBranch();
  if (branch === BASE_BRANCH || branch === "HEAD") {
    throw new Error(
      `Cannot commit pending candidates directly to "${branch}". `
      + "Run translation in a dedicated feature branch or worktree.");
  }

  const runPages = extractPagesFromPaths(parseStatusPaths(status));
  const task = options.task ?? "rashi_tosafot_translation";
  const backend = options.backend ?? "claude";
  const commitMessage = options.message ?? `${task} | ${backend}: new pending translation candidates`;

  const preCommitSha = deps.getCurrentHeadSha ? await deps.getCurrentHeadSha() : undefined;

  const committed = await deps.commitPendingState(commitMessage);
  if (!committed) return;

  await deps.push();

  const postCommitSha = deps.getCurrentHeadSha ? await deps.getCurrentHeadSha() : undefined;

  let prPages = (options.pages && options.pages.length > 0) ? options.pages : runPages;
  if (deps.getBranchChangedPaths) {
    try {
      const branchPaths = await deps.getBranchChangedPaths(BASE_BRANCH, branch);
      const allPages = extractPagesFromPaths(branchPaths);
      if (allPages.length > 0) {
        prPages = allPages;
      }
    } catch {
      // Keep prPages
    }
  }

  const title = formatPrTitle(task, backend, prPages);

  const openPr = await deps.findOpenPr(branch);
  let targetPrNumber: number | undefined;

  if (!openPr) {
    const prNumber = await deps.openPr(
      branch,
      title,
      "Automated batch of newly-generated `status: \"pending\"` translation candidates. Review "
      + "them on their live page (once deployed) with `?rsiReviewKey=<secret>` — this PR itself "
      + "isn't the review surface, just what makes the candidates visible at all.",
    );
    if (typeof prNumber === "number") {
      targetPrNumber = prNumber;
    } else {
      const newlyOpened = await deps.findOpenPr(branch);
      targetPrNumber = newlyOpened?.number;
    }
  } else {
    targetPrNumber = openPr.number;
    if (openPr.title !== title && deps.updatePrTitle) {
      await deps.updatePrTitle(openPr.number, title);
    }
  }

  if (targetPrNumber && deps.getDiffStats && deps.addPrComment && preCommitSha && postCommitSha) {
    const diffStats = await deps.getDiffStats(preCommitSha, postCommitSha);
    const stats = parseDiffStats(diffStats.diff ?? diffStats.numstat ?? "", diffStats.nameStatus);
    if (stats.length > 0) {
      const comment = formatDiffStatsTable(stats);
      await deps.addPrComment(targetPrNumber, comment);
    }
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
): Promise<{number: number; title?: string} | undefined> {
  const {stdout} = await runSubcommand("gh", [
    "pr", "list", "--repo", REPO, "--head", branch, "--state", "open", "--json", "number,title",
  ], debug);
  const prs = JSON.parse(stdout) as Array<{number: number; title: string}>;
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
): Promise<number | undefined> {
  const {stdout} = await runSubcommand("gh", [
    "pr", "create", "--repo", REPO, "--base", BASE_BRANCH, "--head", branch,
    "--title", title, "--body", body,
  ], debug);
  const match = stdout.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

async function updatePrTitleViaGh(
  prNumber: number, title: string, debug = false,
): Promise<void> {
  await runSubcommand("gh", [
    "pr", "edit", String(prNumber), "--repo", REPO, "--title", title,
  ], debug);
}

async function addPrCommentViaGh(
  prNumber: number, comment: string, debug = false,
): Promise<void> {
  await runSubcommand("gh", [
    "pr", "comment", String(prNumber), "--repo", REPO, "--body", comment,
  ], debug);
}

async function getCurrentHeadShaViaCli(debug = false): Promise<string> {
  const {stdout} = await runSubcommand("git", ["rev-parse", "HEAD"], debug);
  return stdout.trim();
}

async function getDiffStatsViaCli(
  fromRef: string, toRef: string, debug = false,
): Promise<{diff: string; numstat: string; nameStatus: string}> {
  const {stdout: diff} = await runSubcommand(
    "git", ["diff", "-U0", fromRef, toRef, "--", ...MANAGED_PATHS], debug);
  const {stdout: numstat} = await runSubcommand(
    "git", ["diff", "--numstat", fromRef, toRef, "--", ...MANAGED_PATHS], debug);
  const {stdout: nameStatus} = await runSubcommand(
    "git", ["diff", "--name-status", fromRef, toRef, "--", ...MANAGED_PATHS], debug);
  return {diff, numstat, nameStatus};
}

async function getBranchChangedPathsViaCli(
  baseBranch: string, _branch: string, debug = false,
): Promise<string[]> {
  const {stdout} = await runSubcommand(
    "git", ["diff", "--name-only", `origin/${baseBranch}...HEAD`, "--", ...MANAGED_PATHS], debug);
  return stdout.split("\n").map(l => l.trim()).filter(Boolean);
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
    updatePrTitle: (prNumber, title) => updatePrTitleViaGh(prNumber, title, debug),
    addPrComment: (prNumber, comment) => addPrCommentViaGh(prNumber, comment, debug),
    getCurrentHeadSha: () => getCurrentHeadShaViaCli(debug),
    getDiffStats: (fromRef, toRef) => getDiffStatsViaCli(fromRef, toRef, debug),
    getBranchChangedPaths: (baseBranch, branch) => getBranchChangedPathsViaCli(
      baseBranch, branch, debug),
  };
}

export const realCommitPendingDeps: CommitPendingDeps = makeRealCommitPendingDeps();
