import {ChildProcess, execFile} from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

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
  debug?: boolean;
  onToolUse?: (toolUse: ToolUseRecord) => void;
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

export function getSubcommandFromToolUse(toolUse: ToolUseRecord): string | undefined {
  const input = toolUse.input as {command?: string; CommandLine?: string} | undefined;
  return input?.command ?? input?.CommandLine;
}

export function matchesWildcardPattern(command: string, pattern: string): boolean {
  const regexStr = "^" + pattern
    .split("*")
    .map(segment => segment.replace(/[$()+.?[\\\]^{|}]/g, "\\$&"))
    .join(".*") + "$";
  return new RegExp(regexStr).test(command);
}

/**
 * Checks whether a command is allowed according to the allowedTools patterns.
 * Explicitly rejects any command targeting sefaria.org or starting with python.
 */
export function isCommandAllowed(command: string, allowedTools?: string[]): boolean {
  // External lookups to sefaria.org are strictly forbidden regardless
  if (/sefaria\.org/i.test(command)) return false;
  // Block any command starting with python
  if (/(?:^|[&;|]\s*)(?:.*\/)?python/i.test(command.trim())) return false;
  if (!allowedTools || allowedTools.length === 0) return true;

  for (const toolPattern of allowedTools) {
    const bashMatch = toolPattern.match(/^Bash\((.*)\)$/);
    if (bashMatch) {
      const pattern = bashMatch[1].trim();
      if (matchesWildcardPattern(command, pattern)) return true;
    }
  }
  return false;
}

export interface ToolFilterShims {
  shimDir: string;
  cleanup: () => void;
}

function findExecutableInPath(name: string, searchPath: string): string | undefined {
  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir) continue;
    const fullPath = path.join(dir, name);
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return fullPath;
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

/**
 * Creates temporary executable shims prepended to PATH when running headless agents.
 * Blocks anything starting with python, arbitrary node execution (allowing only context_fetch_cli),
 * and blocks curl/wget targeting sefaria.org.
 */
export function createToolFilterShims(): ToolFilterShims {
  const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-tool-shims-"));
  const originalPath = process.env.PATH ?? "";
  const realNode = process.execPath;

  const pythonShim = "#!/bin/sh\n"
    + "echo \"Blocked: python execution is forbidden. External lookups to sefaria.org and scripting are not allowed.\" >&2\n"
    + "exit 1\n";

  // Dynamically block anything in PATH that starts with python
  const pythonBinaries = new Set(["python", "python3"]);
  for (const dir of originalPath.split(path.delimiter)) {
    try {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir)) {
        if (entry.startsWith("python")) {
          pythonBinaries.add(entry);
        }
      }
    } catch {
      // Ignore inaccessible directories
    }
  }
  for (const bin of pythonBinaries) {
    fs.writeFileSync(path.join(shimDir, bin), pythonShim, {mode: 0o755});
  }

  const nodeShim = "#!/bin/sh\n"
    + "allowed=0\n"
    + "for arg in \"$@\"; do\n"
    + "  case \"$arg\" in\n"
    + "    *context_fetch_cli*|*ts-node*|*npx*)\n"
    + "      allowed=1\n"
    + "      ;;\n"
    + "    -e|--eval)\n"
    + "      allowed=0\n"
    + "      break\n"
    + "      ;;\n"
    + "  esac\n"
    + "done\n"
    + "if [ \"$allowed\" -eq 0 ]; then\n"
    + "  echo \"Blocked: arbitrary node execution is forbidden. Only context_fetch_cli is permitted.\" >&2\n"
    + "  exit 1\n"
    + "fi\n"
    + `exec "${realNode}" "$@"\n`;
  fs.writeFileSync(path.join(shimDir, "node"), nodeShim, {mode: 0o755});

  const realCurl = findExecutableInPath("curl", originalPath);
  const curlShim = realCurl
    ? "#!/bin/sh\n"
      + "for arg in \"$@\"; do\n"
      + "  case \"$arg\" in\n"
      + "    *sefaria.org*)\n"
      + "      echo \"Blocked: lookups to sefaria.org are forbidden.\" >&2\n"
      + "      exit 1\n"
      + "      ;;\n"
      + "  esac\n"
      + "done\n"
      + `exec "${realCurl}" "$@"\n`
    : "#!/bin/sh\n"
      + "echo \"Blocked: curl is not available.\" >&2\n"
      + "exit 1\n";
  fs.writeFileSync(path.join(shimDir, "curl"), curlShim, {mode: 0o755});

  const realWget = findExecutableInPath("wget", originalPath);
  const wgetShim = realWget
    ? "#!/bin/sh\n"
      + "for arg in \"$@\"; do\n"
      + "  case \"$arg\" in\n"
      + "    *sefaria.org*)\n"
      + "      echo \"Blocked: lookups to sefaria.org are forbidden.\" >&2\n"
      + "      exit 1\n"
      + "      ;;\n"
      + "  esac\n"
      + "done\n"
      + `exec "${realWget}" "$@"\n`
    : "#!/bin/sh\n"
      + "echo \"Blocked: wget is not available.\" >&2\n"
      + "exit 1\n";
  fs.writeFileSync(path.join(shimDir, "wget"), wgetShim, {mode: 0o755});

  return {
    shimDir,
    cleanup: () => {
      try {
        fs.rmSync(shimDir, {recursive: true, force: true});
      } catch {
        // Best-effort cleanup
      }
    },
  };
}

export const createAgyToolFilterShims = createToolFilterShims;

export interface ExecStreamingOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  maxBuffer?: number;
  onStdoutLine?: (line: string) => void;
  onChild?: (child: ChildProcess) => void;
}

export function execFileWithStreaming(
  file: string,
  args: string[],
  options: ExecStreamingOptions,
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const child = execFile(file, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeout,
      maxBuffer: options.maxBuffer,
    }, (error, stdout, stderr) => {
      if (options.onStdoutLine && buffer.trim()) {
        options.onStdoutLine(buffer);
        buffer = "";
      }
      if (error) {
        const err = error as Error & {stdout?: string; stderr?: string};
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({stdout, stderr});
      }
    });

    options.onChild?.(child);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      if (!options.onStdoutLine) return;
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          options.onStdoutLine(line);
        }
      }
    });
  });
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

  if (options.debug) {
    console.log(`  [agent] Running agy${options.model ? ` (model: ${options.model})` : ""}...`);
  }

  let shims: ToolFilterShims | undefined;
  if (options.allowedTools && options.allowedTools.length > 0) {
    shims = createToolFilterShims();
  }

  const env: NodeJS.ProcessEnv = shims
    ? {...process.env, PATH: `${shims.shimDir}:${process.env.PATH ?? ""}`}
    : process.env;

  const seenStepIndices = new Set<number>();
  let childProcess: ChildProcess | undefined;
  let stdout: string;
  try {
    ({stdout} = await execFileWithStreaming("agy", args, {
      cwd: options.cwd,
      env,
      timeout: options.timeoutMs,
      maxBuffer: 1024 * 1024 * 32,
      onChild: (child) => {
        childProcess = child;
      },
      onStdoutLine: (line) => {
        let parsed: AgyStreamLine;
        try {
          parsed = JSON.parse(line) as AgyStreamLine;
        } catch {
          return;
        }
        if (parsed.event === "step_update" && parsed.step_update) {
          const step = parsed.step_update;
          const stepIndex = step.step_index;
          const isNewStep = stepIndex === undefined || !seenStepIndices.has(stepIndex);
          if (step.step_type === "tool" && step.tool_info && isNewStep) {
            if (stepIndex !== undefined) seenStepIndices.add(stepIndex);
            const toolName = step.tool_name ?? step.tool_info.name ?? "unknown";
            const rawParams = step.tool_info.parameters ?? {};
            const input = {
              ...rawParams,
              ...(rawParams.CommandLine && !rawParams.command
                ? {command: rawParams.CommandLine}
                : {}),
            };
            const toolUse = {name: toolName, input};
            const cmd = getSubcommandFromToolUse(toolUse);
            if (cmd) {
              if (options.allowedTools && !isCommandAllowed(cmd, options.allowedTools)) {
                if (options.debug) {
                  console.log(`    [subcommand blocked] ${cmd}`);
                }
                childProcess?.kill("SIGKILL");
                throw new AgentError(
                  `Disallowed command attempted: "${cmd}". Python scripts and external lookups to sefaria.org are blocked.`,
                  undefined,
                  "agy",
                );
              }
              if (options.debug) {
                console.log(`    [subcommand] ${cmd}`);
              }
            }
            options.onToolUse?.(toolUse);
          }
        }
      },
    }));
  } catch (e) {
    throw asAgyCliError(e) ?? e;
  } finally {
    shims?.cleanup();
  }

  const {toolUses, result} = parseAgyStreamJsonLines(stdout);
  if (!result) {
    throw new Error("Headless agy call produced no result event");
  }
  if (result.status === "ERROR") {
    throw new AgentError(result.error || "Agy returned an error", undefined, "agy");
  }

  const filteredToolUses = options.allowedTools
    ? toolUses.filter(t => {
      const cmd = getSubcommandFromToolUse(t);
      return !cmd || isCommandAllowed(cmd, options.allowedTools);
    })
    : toolUses;

  return {
    text: result.response ?? "",
    model: options.model,
    costUsd: undefined,
    toolUses: filteredToolUses,
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
  if (options.debug) {
    console.log(`  [agent] Running claude${options.model ? ` (model: ${options.model})` : ""}...`);
  }

  let shims: ToolFilterShims | undefined;
  if (options.allowedTools && options.allowedTools.length > 0) {
    shims = createToolFilterShims();
  }

  const env: NodeJS.ProcessEnv = shims
    ? {...process.env, PATH: `${shims.shimDir}:${process.env.PATH ?? ""}`}
    : process.env;

  let childProcess: ChildProcess | undefined;
  let stdout: string;
  try {
    ({stdout} = await execFileWithStreaming(
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
        env,
        timeout: options.timeoutMs,
        maxBuffer: 1024 * 1024 * 32,
        onChild: (child) => {
          childProcess = child;
        },
        onStdoutLine: (line) => {
          let parsed: {type?: string};
          try {
            parsed = JSON.parse(line) as {type?: string};
          } catch {
            return;
          }
          if (parsed.type === "assistant") {
            for (const block of (parsed as unknown as ClaudeCliAssistantLine).message.content) {
              if (block.type === "tool_use" && block.name) {
                const toolUse = {name: block.name, input: block.input};
                const cmd = getSubcommandFromToolUse(toolUse);
                if (cmd) {
                  if (options.allowedTools && !isCommandAllowed(cmd, options.allowedTools)) {
                    if (options.debug) {
                      console.log(`    [subcommand blocked] ${cmd}`);
                    }
                    childProcess?.kill("SIGKILL");
                    throw new AgentError(
                      `Disallowed command attempted: "${cmd}". Python scripts and external lookups to sefaria.org are blocked.`,
                      undefined,
                      "claude",
                    );
                  }
                  if (options.debug) {
                    console.log(`    [subcommand] ${cmd}`);
                  }
                }
                options.onToolUse?.(toolUse);
              }
            }
          }
        },
      },
    ));
  } catch (e) {
    throw asClaudeCliError(e) ?? e;
  } finally {
    shims?.cleanup();
  }
  const {toolUses, result} = parseClaudeStreamJsonLines(stdout);
  if (!result) {
    throw new Error("Headless Claude call produced no result line");
  }
  if (result.is_error) {
    throw new AgentError(result.result, result.api_error_status, "claude");
  }
  const filteredToolUses = options.allowedTools
    ? toolUses.filter(t => {
      const cmd = getSubcommandFromToolUse(t);
      return !cmd || isCommandAllowed(cmd, options.allowedTools);
    })
    : toolUses;

  return {
    text: result.result,
    model: primaryClaudeModel(result.modelUsage),
    costUsd: result.total_cost_usd,
    toolUses: filteredToolUses,
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
