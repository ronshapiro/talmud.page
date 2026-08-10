import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);

export interface HeadlessClaudeOptions {
  cwd?: string;
  timeoutMs?: number;
}

export interface HeadlessClaudeResult {
  text: string;
  // The canonical model ID that actually ran (e.g. "claude-sonnet-5"), read back from
  // `--output-format json`'s modelUsage — undefined if the CLI didn't report one. Recording this
  // per generated artifact is what Phase 4's model-routing learning reads later.
  model: string | undefined;
  costUsd: number | undefined;
}

export type HeadlessClaudeRunner =
  (prompt: string, options?: HeadlessClaudeOptions) => Promise<HeadlessClaudeResult>;

interface ClaudeCliJsonOutput {
  result: string;
  is_error: boolean; // eslint-disable-line camelcase
  total_cost_usd?: number; // eslint-disable-line camelcase
  modelUsage?: Record<string, unknown>;
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
  const {stdout} = await execFileAsync(
    "claude",
    ["-p", prompt, "--output-format", "json"],
    {
      cwd: options.cwd,
      timeout: options.timeoutMs,
      maxBuffer: 1024 * 1024 * 32,
    },
  );
  const parsed = JSON.parse(stdout) as ClaudeCliJsonOutput;
  if (parsed.is_error) {
    throw new Error(`Headless Claude call failed: ${parsed.result}`);
  }
  return {
    text: parsed.result,
    model: parsed.modelUsage ? Object.keys(parsed.modelUsage)[0] : undefined,
    costUsd: parsed.total_cost_usd,
  };
};
