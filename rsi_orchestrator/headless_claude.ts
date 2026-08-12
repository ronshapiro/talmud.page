import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);

// NOT YET IMPLEMENTED: `claude -p` also has a `--max-budget-usd <amount>` flag (see
// `claude --help`), not passed here yet — see RecursiveSelfImprovingAgentPlan.md's "Budget"
// section. `--model` (below) is now pinned per call; without it the CLI picked the model on its
// own — confirmed on a real run, which came back mostly claude-haiku-4-5 with one claude-sonnet-5
// call, none of it requested by this code.
export interface HeadlessClaudeOptions {
  cwd?: string;
  timeoutMs?: number;
  // Explicit model alias or full name (e.g. "sonnet", "claude-sonnet-5"). Without this, `claude
  // -p` chooses on its own — see the note above. Each task type should pass its own pinned
  // model; Phase 4's routing tuner is what eventually changes this value based on logged outcomes
  // (see RecursiveSelfImprovingAgentPlan.md's "Model routing" section), not this wrapper.
  model?: string;
  // Defaults to a safe read-only set — this task family only needs to read repo files, not run
  // arbitrary commands or write anything. Without an explicit allow-list, headless calls have no
  // way to approve tool use, so anything beyond the default-allowed tools gets silently denied
  // and Claude wastes turns retrying workarounds instead of just reading the file.
  allowedTools?: string[];
}

const DEFAULT_ALLOWED_TOOLS = ["Read", "Grep", "Glob"];

export interface ToolUseRecord {
  name: string;
  input: unknown;
}

export interface HeadlessClaudeResult {
  text: string;
  // The canonical model ID that actually did the substantive work (highest-cost entry in
  // modelUsage — a session can involve more than one model, e.g. a cheap model for a small
  // sub-step alongside the model that did the real generation). Recording this per generated
  // artifact is what Phase 4's model-routing learning reads later.
  model: string | undefined;
  costUsd: number | undefined;
  // Every Read/Grep/Glob (or whatever --allowedTools permits) call Claude made this turn, in
  // order, with its input (e.g. {file_path: "..."} or {pattern: "..."}). This is the raw signal
  // for context-usage logging: rather than a hand-picked list of "which commentaries matter",
  // record what Claude actually reads across many real calls and let that data answer the
  // question. See RecursiveSelfImprovingAgentPlan.md's "learned, not hand-picked" framing.
  toolUses: ToolUseRecord[];
}

export type HeadlessClaudeRunner =
  (prompt: string, options?: HeadlessClaudeOptions) => Promise<HeadlessClaudeResult>;

/** Thrown when the CLI itself reports an error (as opposed to a malformed-response parse error).
 * `isRateLimited` distinguishes a usage/session-limit hit (429) — expected under subscription
 * billing, and the caller should stop the run rather than keep retrying every remaining
 * candidate against the same wall — from a genuine unexpected failure. */
export class HeadlessClaudeError extends Error {
  public readonly isRateLimited: boolean;

  constructor(
    message: string,
    public readonly apiErrorStatus: number | undefined,
  ) {
    super(message);
    // Without this, `instanceof HeadlessClaudeError` silently returns false at this project's
    // (unset, so ES3-default) tsconfig target — a well-known gotcha extending Error in TS. Found
    // the hard way: a real run kept "skipping" every candidate after a rate limit instead of
    // stopping, because the isRateLimited branch's instanceof check never matched.
    Object.setPrototypeOf(this, HeadlessClaudeError.prototype);
    this.name = "HeadlessClaudeError";
    this.isRateLimited = apiErrorStatus === 429;
  }
}

interface ClaudeCliResultLine {
  type: "result";
  result: string;
  is_error: boolean; // eslint-disable-line camelcase
  total_cost_usd?: number; // eslint-disable-line camelcase
  api_error_status?: number; // eslint-disable-line camelcase
  modelUsage?: Record<string, {costUSD?: number}>;
}

interface ClaudeCliAssistantLine {
  type: "assistant";
  message: {
    content: Array<{type: string; name?: string; input?: unknown}>;
  };
}

export function primaryModel(
  modelUsage: ClaudeCliResultLine["modelUsage"],
): string | undefined {
  if (!modelUsage) return undefined;
  const entries = Object.entries(modelUsage);
  if (entries.length === 0) return undefined;
  return entries.reduce((a, b) => ((b[1].costUSD ?? 0) > (a[1].costUSD ?? 0) ? b : a))[0];
}

/**
 * `--output-format stream-json` writes one JSON object per line: assistant turns (which carry
 * tool_use blocks — this is where toolUses comes from), tool results, system events, and finally
 * a single `type: "result"` line with the same summary fields the plain `json` format returns.
 * Tolerant of a trailing partial/non-JSON line, which happens when the process is killed
 * mid-write.
 */
export function parseStreamJsonLines(stdout: string): {
  toolUses: ToolUseRecord[];
  result: ClaudeCliResultLine | undefined;
} {
  const toolUses: ToolUseRecord[] = [];
  let result: ClaudeCliResultLine | undefined;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let parsed: {type?: string};
    try {
      parsed = JSON.parse(line) as {type?: string};
    } catch {
      continue;
    }
    if (parsed.type === "assistant") {
      for (const block of (parsed as unknown as ClaudeCliAssistantLine).message.content) {
        if (block.type === "tool_use" && block.name) {
          toolUses.push({name: block.name, input: block.input});
        }
      }
    } else if (parsed.type === "result") {
      result = parsed as unknown as ClaudeCliResultLine;
    }
  }
  return {toolUses, result};
}

/**
 * The CLI often still writes its stream-json output to stdout even when the process exits
 * non-zero (e.g. a rate limit) — execFile treats that as a rejected promise carrying an error
 * whose `.stdout` holds it. Recover the structured error from the trailing result line rather
 * than surfacing a raw exec failure with no usable information.
 */
export function asCliError(error: unknown): HeadlessClaudeError | undefined {
  const stdout = (error as {stdout?: string} | undefined)?.stdout;
  if (!stdout) return undefined;
  const {result} = parseStreamJsonLines(stdout);
  if (!result) return undefined;
  return new HeadlessClaudeError(result.result, result.api_error_status);
}

/**
 * Invokes the Claude Code CLI in headless mode (`claude -p`). Authenticated exactly the way
 * interactive Claude Code already is on this machine — no separate API key, so usage draws on the
 * same subscription rather than metered API billing. See RecursiveSelfImprovingAgentPlan.md for
 * why this is self-hosted this way rather than through Managed Agents.
 *
 * Exported as a plain function value (not a class) so callers can inject a fake implementation in
 * tests instead of depending on this one directly.
 */
export const runHeadlessClaude: HeadlessClaudeRunner = async (prompt, options = {}) => {
  let stdout: string;
  try {
    ({stdout} = await execFileAsync(
      "claude",
      [
        "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--allowedTools", (options.allowedTools ?? DEFAULT_ALLOWED_TOOLS).join(","),
        ...(options.model ? ["--model", options.model] : []),
      ],
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: 1024 * 1024 * 32,
      },
    ));
  } catch (e) {
    throw asCliError(e) ?? e;
  }
  const {toolUses, result} = parseStreamJsonLines(stdout);
  if (!result) {
    throw new Error("Headless Claude call produced no result line");
  }
  if (result.is_error) {
    throw new HeadlessClaudeError(result.result, result.api_error_status);
  }
  return {
    text: result.result,
    model: primaryModel(result.modelUsage),
    costUsd: result.total_cost_usd,
    toolUses,
  };
};
