import {execFile} from "child_process";
import {promisify} from "util";

const execFileAsync = promisify(execFile);

export interface HeadlessClaudeOptions {
  cwd?: string;
  timeoutMs?: number;
}

export type HeadlessClaudeRunner =
  (prompt: string, options?: HeadlessClaudeOptions) => Promise<string>;

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
    ["-p", prompt, "--output-format", "text"],
    {
      cwd: options.cwd,
      timeout: options.timeoutMs,
      maxBuffer: 1024 * 1024 * 32,
    },
  );
  return stdout;
};
