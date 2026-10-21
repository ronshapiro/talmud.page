import {ContextUsageEntry} from "../precomputed/rsi_state/context_usage_log";
import {books} from "../books";
import {splitOnBookName} from "../refs";
import {extractRequestedRefs, parseRefLocation} from "./context_fetch";

interface PageLocation {
  book: string;
  page: string;
}

/**
 * Per-model summary of how generation calls use context_fetch_cli — the yardstick for whether a
 * change to the context-lookup guidance actually reduced wasted fetches. Run with `--since` set
 * to the date of a prompt change to compare against the calls before it.
 */

export interface ModelContextStats {
  model: string;
  calls: number;
  fetchingCalls: number;
  refs: number; // unique refs per call, summed over calls
  ownSegmentCalls: number; // fetching calls that requested the comment's own (inlined) segment
  offPageRefs: number;
  offBookRefs: number;
  earlyPageRefs: number; // off-page refs on 2a-3b of the same book: the "calibration hunt" signal
  commands: Record<string, number>; // subcommand -> count, deduped within each call
  costUsd: number;
}

export interface ContextReportOptions {
  since?: Date;
  taskType?: string;
  callKind?: string;
}

const EARLY_PAGES = new Set(["2a", "2b", "3a", "3b"]);

function normalizeModel(model: string | undefined): string {
  return (model ?? "unknown").replace(/-\d{8}$/, "");
}

function baseSegmentRef(commentRef: string): string {
  return commentRef.replace(/^.*? on /, "").split(":").slice(0, 2).join(":");
}

function commandText(input: unknown): string | undefined {
  const {command, CommandLine} = (input ?? {}) as {command?: string; CommandLine?: string};
  return command ?? CommandLine;
}

const SUBCOMMANDS = new Set([
  "get-refs", "get-comment-refs", "get-neighbors", "get-prior-sugyot", "search", "wikipedia",
]);

function subcommandOf(command: string): string | undefined {
  const match = /context_fetch_cli\S*\s+([a-z-]+)/.exec(command);
  if (match && SUBCOMMANDS.has(match[1])) return match[1];
  return /\bcurl\b.*wikipedia\.org/.test(command) ? "wikipedia" : undefined;
}

export function computeContextReport(
  log: ContextUsageEntry[], options: ContextReportOptions = {},
): ModelContextStats[] {
  const {since, taskType, callKind = "generate"} = options;
  // parseRefLocation costs ~5ms per call, so split the ref directly and only fall back to it
  // (cached per page) for book names that aren't canonical, e.g. aliases like "Hullin".
  const slowLocations = new Map<string, PageLocation | undefined>();
  const locate = (ref: string): PageLocation | undefined => {
    const pageKey = ref.replace(/^.*? on /, "").split(":")[0];
    const [book, page] = splitOnBookName(pageKey);
    if (books.byCanonicalName[book]) return {book, page};
    if (!slowLocations.has(pageKey)) {
      const location = parseRefLocation(pageKey);
      slowLocations.set(pageKey, location && {
        book: location.book.canonicalName, page: location.page,
      });
    }
    return slowLocations.get(pageKey);
  };

  const byModel = new Map<string, ModelContextStats>();
  for (const entry of log) {
    if (entry.callKind !== callKind) continue;
    if (taskType && entry.taskType !== taskType) continue;
    if (since && new Date(entry.timestamp) < since) continue;

    const model = normalizeModel(entry.model);
    let stats = byModel.get(model);
    if (!stats) {
      stats = {
        model,
        calls: 0,
        fetchingCalls: 0,
        refs: 0,
        ownSegmentCalls: 0,
        offPageRefs: 0,
        offBookRefs: 0,
        earlyPageRefs: 0,
        commands: {},
        costUsd: 0,
      };
      byModel.set(model, stats);
    }
    stats.calls++;
    stats.costUsd += entry.costUsd ?? 0;

    const commands = new Set(entry.toolUses
      .map(use => commandText(use.input))
      .filter((command): command is string => command !== undefined));
    let fetched = false;
    for (const command of commands) {
      const subcommand = subcommandOf(command);
      if (!subcommand) continue;
      fetched = true;
      stats.commands[subcommand] = (stats.commands[subcommand] ?? 0) + 1;
    }
    if (fetched) stats.fetchingCalls++;

    const refs = extractRequestedRefs(entry.toolUses);
    stats.refs += refs.length;
    if (refs.includes(baseSegmentRef(entry.ref))) stats.ownSegmentCalls++;
    const target = locate(entry.ref);
    for (const ref of refs) {
      const location = locate(ref);
      if (target && location?.book === target.book && location.page === target.page) continue;
      stats.offPageRefs++;
      if (!target || location?.book !== target.book) {
        stats.offBookRefs++;
      } else if (EARLY_PAGES.has(location.page) && !EARLY_PAGES.has(target.page)) {
        stats.earlyPageRefs++;
      }
    }
  }
  return Array.from(byModel.values()).sort((a, b) => b.calls - a.calls);
}

function percent(numerator: number, denominator: number): string {
  return denominator === 0 ? "-" : `${Math.round((100 * numerator) / denominator)}%`;
}

export function formatContextReport(stats: ModelContextStats[]): string {
  if (stats.length === 0) return "No matching calls in the context usage log.";
  const header = [
    "model", "calls", "fetch%", "refs/fetch", "own-seg%", "off-page%", "off-book%", "2a-3b%",
    "$/call", "commands",
  ];
  const rows = stats.map(s => [
    s.model,
    String(s.calls),
    percent(s.fetchingCalls, s.calls),
    s.fetchingCalls === 0 ? "-" : (s.refs / s.fetchingCalls).toFixed(1),
    percent(s.ownSegmentCalls, s.fetchingCalls),
    percent(s.offPageRefs, s.refs),
    percent(s.offBookRefs, s.refs),
    percent(s.earlyPageRefs, s.refs),
    s.calls === 0 ? "-" : (s.costUsd / s.calls).toFixed(3),
    Object.entries(s.commands).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "),
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  return [header, ...rows]
    .map(row => row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i])))
      .join("  "))
    .join("\n");
}
