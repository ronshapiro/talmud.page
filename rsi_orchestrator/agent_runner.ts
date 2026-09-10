import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);

export type AgentBackend = "claude" | "agy";

export interface ToolUseRecord {
  name: string;
  input: unknown;
}

export interface AgentOptions {
  cwd?: string;
  timeoutMs?: number;
  model?: string;
  allowedTools?: string[];
  backend?: AgentBackend;
  dangerouslySkipPermissions?: boolean;
}

export interface AgentResult {
  text: string;
  model: string | undefined;
  costUsd: number | undefined;
  toolUses: ToolUseRecord[];
  durationSeconds?: number;
}

export type AgentRunner = (prompt: string, options?: AgentOptions) => Promise<AgentResult>;

/**
 * Unified error thrown when an agent runner CLI fails.
 * `isRateLimited` flags whether the error is due to session limits, quotas, or 429 status.
 */
export class AgentError extends Error {
  public readonly isRateLimited: boolean;

  constructor(
    message: string,
    public readonly apiErrorStatus?: number,
    public readonly backend?: AgentBackend,
  ) {
    super(message);
    Object.setPrototypeOf(this, AgentError.prototype);
    this.name = "AgentError";
    this.isRateLimited = apiErrorStatus === 429
      || /rate.?limit|quota.?exceeded|resource.?exhausted|session limit/i.test(message);
  }
}

/* eslint-disable camelcase */
interface AgyStepUpdate {
  step_index?: number;
  state?: string;
  step_type?: string;
  tool_name?: string;
  tool_info?: {
    name?: string;
    parameters?: Record<string, unknown>;
  };
}

interface AgyResultEvent {
  conversation_id?: string;
  status: "SUCCESS" | "ERROR";
  response?: string;
  error?: string;
  duration_seconds?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    thinking_tokens?: number;
    cache_read_tokens?: number;
    total_tokens?: number;
  };
}

interface AgyStreamLine {
  event?: string;
  step_update?: AgyStepUpdate;
  result?: AgyResultEvent;
}
/* eslint-enable camelcase */

/**
 * Parses `agy -p --output-format stream-json` lines.
 * Extracts tool use records from `step_update` events and the final result from the `result` event.
 */
export function parseAgyStreamJsonLines(stdout: string): {
  toolUses: ToolUseRecord[];
  result: AgyResultEvent | undefined;
} {
  const toolUses: ToolUseRecord[] = [];
  const seenStepIndices = new Set<number>();
  let result: AgyResultEvent | undefined;

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let parsed: AgyStreamLine;
    try {
      parsed = JSON.parse(line) as AgyStreamLine;
    } catch {
      continue;
    }

    if (parsed.event === "step_update" && parsed.step_update) {
      const step = parsed.step_update;
      const stepIndex = step.step_index;
      const isNewStep = stepIndex === undefined || !seenStepIndices.has(stepIndex);
      if (step.step_type === "tool" && step.tool_info && isNewStep) {
        if (stepIndex !== undefined) seenStepIndices.add(stepIndex);
        const toolName = step.tool_name ?? step.tool_info.name ?? "unknown";
        const rawParams = step.tool_info.parameters ?? {};
        // Normalize CommandLine to also include `command` for Claude tool readers compatibility
        const input = {
          ...rawParams,
          ...(rawParams.CommandLine && !rawParams.command
            ? {command: rawParams.CommandLine}
            : {}),
        };
        toolUses.push({name: toolName, input});
      }
    } else if (parsed.event === "result" && parsed.result) {
      result = parsed.result;
    }
  }

  return {toolUses, result};
}

export function asAgyCliError(error: unknown): AgentError | undefined {
  const stdout = (error as {stdout?: string} | undefined)?.stdout;
  const stderr = (error as {stderr?: string} | undefined)?.stderr;
  if (stdout) {
    const {result} = parseAgyStreamJsonLines(stdout);
    if (result && result.status === "ERROR") {
      return new AgentError(result.error || "Agy error", undefined, "agy");
    }
  }
  const message = stderr || (error as Error | undefined)?.message;
  if (message && /rate.?limit|quota.?exceeded|resource.?exhausted|session limit/i.test(message)) {
    return new AgentError(message, 429, "agy");
  }
  return undefined;
}

/**
 * Invokes the Antigravity CLI in headless mode (`agy -p`).
 */
export const runHeadlessAgy: AgentRunner = async (prompt, options = {}) => {
  const args = [
    "-p", prompt,
    "--output-format", "stream-json",
  ];
  if (options.dangerouslySkipPermissions !== false) {
    args.push("--dangerously-skip-permissions");
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.timeoutMs) {
    args.push("--print-timeout", `${Math.ceil(options.timeoutMs / 1000)}s`);
  }

  let stdout: string;
  try {
    ({stdout} = await execFileAsync("agy", args, {
      cwd: options.cwd,
      timeout: options.timeoutMs,
      maxBuffer: 1024 * 1024 * 32,
    }));
  } catch (e) {
    throw asAgyCliError(e) ?? e;
  }

  const {toolUses, result} = parseAgyStreamJsonLines(stdout);
  if (!result) {
    throw new Error("Headless agy call produced no result event");
  }
  if (result.status === "ERROR") {
    throw new AgentError(result.error || "Agy returned an error", undefined, "agy");
  }

  return {
    text: result.response ?? "",
    model: options.model,
    costUsd: undefined,
    toolUses,
    durationSeconds: result.duration_seconds,
  };
};

/* ============================================================================
 * Claude CLI Runner (`claude -p`)
 * ============================================================================ */

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

export function primaryClaudeModel(
  modelUsage: ClaudeCliResultLine["modelUsage"],
): string | undefined {
  if (!modelUsage) return undefined;
  const entries = Object.entries(modelUsage);
  if (entries.length === 0) return undefined;
  return entries.reduce((a, b) => ((b[1].costUSD ?? 0) > (a[1].costUSD ?? 0) ? b : a))[0];
}

/**
 * `--output-format stream-json` writes one JSON object per line: assistant turns (which carry
 * tool_use blocks), tool results, system events, and a trailing `type: "result"` line.
 */
export function parseClaudeStreamJsonLines(stdout: string): {
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

export function asClaudeCliError(error: unknown): AgentError | undefined {
  const stdout = (error as {stdout?: string} | undefined)?.stdout;
  if (!stdout) return undefined;
  const {result} = parseClaudeStreamJsonLines(stdout);
  if (!result) return undefined;
  return new AgentError(result.result, result.api_error_status, "claude");
}

const DEFAULT_CLAUDE_ALLOWED_TOOLS = ["Read", "Grep", "Glob"];

export const runHeadlessClaude: AgentRunner = async (prompt, options = {}) => {
  let stdout: string;
  try {
    ({stdout} = await execFileAsync(
      "claude",
      [
        "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--allowedTools", (options.allowedTools ?? DEFAULT_CLAUDE_ALLOWED_TOOLS).join(","),
        ...(options.model ? ["--model", options.model] : []),
      ],
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: 1024 * 1024 * 32,
      },
    ));
  } catch (e) {
    throw asClaudeCliError(e) ?? e;
  }
  const {toolUses, result} = parseClaudeStreamJsonLines(stdout);
  if (!result) {
    throw new Error("Headless Claude call produced no result line");
  }
  if (result.is_error) {
    throw new AgentError(result.result, result.api_error_status, "claude");
  }
  return {
    text: result.result,
    model: primaryClaudeModel(result.modelUsage),
    costUsd: result.total_cost_usd,
    toolUses,
  };
};

/* ============================================================================
 * Runner Factory
 * ============================================================================ */

/**
 * Returns an AgentRunner implementation for the specified backend.
 */
export function getAgentRunner(backend: AgentBackend = "claude"): AgentRunner {
  switch (backend) {
    case "agy":
      return runHeadlessAgy;
    case "claude":
      return runHeadlessClaude;
    default:
      throw new Error(`Unknown agent backend: "${String(backend)}"`);
  }
}
