import {
  AgentError,
  asAgyCliError,
  getAgentRunner,
  parseAgyStreamJsonLines,
  runHeadlessAgy,
} from "./agent_runner";
import {runHeadlessClaude} from "./headless_claude";

describe("parseAgyStreamJsonLines", () => {
  test("returns empty toolUses and undefined result for empty output", () => {
    expect(parseAgyStreamJsonLines("")).toEqual({toolUses: [], result: undefined});
  });

  test("parses tool uses from step_update events", () => {
    const stdout = [
      JSON.stringify({event: "init", conversation_id: "123"}),
      JSON.stringify({
        event: "step_update",
        step_update: {
          step_index: 1,
          state: "ACTIVE",
          step_type: "tool",
          tool_name: "run_command",
          tool_info: {
            name: "run_command",
            parameters: {CommandLine: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs '[\"Zevachim 2a:1\"]'"},
          },
        },
      }),
      JSON.stringify({
        event: "step_update",
        step_update: {
          step_index: 1,
          state: "DONE",
          step_type: "tool",
          tool_name: "run_command",
          tool_info: {
            name: "run_command",
            parameters: {CommandLine: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs '[\"Zevachim 2a:1\"]'"},
          },
        },
      }),
      JSON.stringify({
        event: "result",
        result: {
          status: "SUCCESS",
          response: "{\"hebrew\": \"שלום\", \"english\": \"hello\"}",
          duration_seconds: 3.5,
          usage: {input_tokens: 100, output_tokens: 50},
        },
      }),
    ].join("\n");

    const {toolUses, result} = parseAgyStreamJsonLines(stdout);
    expect(toolUses).toHaveLength(1);
    expect(toolUses[0].name).toBe("run_command");
    expect((toolUses[0].input as {CommandLine: string; command: string}).CommandLine).toContain("context_fetch_cli.ts");
    expect((toolUses[0].input as {CommandLine: string; command: string}).command).toContain("context_fetch_cli.ts");
    expect(result).toBeDefined();
    expect(result?.status).toBe("SUCCESS");
    expect(result?.response).toBe("{\"hebrew\": \"שלום\", \"english\": \"hello\"}");
  });

  test("deduplicates tool step_updates sharing the same step_index", () => {
    const stdout = [
      JSON.stringify({
        event: "step_update",
        step_update: {
          step_index: 5,
          step_type: "tool",
          tool_name: "run_command",
          tool_info: {name: "run_command", parameters: {CommandLine: "cmd1"}},
        },
      }),
      JSON.stringify({
        event: "step_update",
        step_update: {
          step_index: 5,
          step_type: "tool",
          tool_name: "run_command",
          tool_info: {name: "run_command", parameters: {CommandLine: "cmd1"}},
        },
      }),
    ].join("\n");

    const {toolUses} = parseAgyStreamJsonLines(stdout);
    expect(toolUses).toHaveLength(1);
  });

  test("ignores invalid or non-JSON lines", () => {
    const stdout = [
      "not json line",
      JSON.stringify({
        event: "result",
        result: {status: "SUCCESS", response: "ok"},
      }),
      "{broken json",
    ].join("\n");

    const {result} = parseAgyStreamJsonLines(stdout);
    expect(result?.response).toBe("ok");
  });
});

describe("asAgyCliError", () => {
  test("returns undefined when no stdout or stderr indicates an error", () => {
    expect(asAgyCliError(new Error("generic error"))).toBeUndefined();
  });

  test("extracts error message from result event on stdout", () => {
    const stdout = JSON.stringify({
      event: "result",
      result: {status: "ERROR", error: "Model quota exceeded"},
    });
    const err = asAgyCliError({stdout});
    expect(err).toBeInstanceOf(AgentError);
    expect(err?.message).toBe("Model quota exceeded");
    expect(err?.isRateLimited).toBe(true);
    expect(err?.backend).toBe("agy");
  });

  test("identifies rate limit from stderr message", () => {
    const err = asAgyCliError({stderr: "RESOURCE_EXHAUSTED: Rate limit reached"});
    expect(err).toBeInstanceOf(AgentError);
    expect(err?.isRateLimited).toBe(true);
  });
});

describe("getAgentRunner", () => {
  test("returns runHeadlessAgy for backend agy", () => {
    expect(getAgentRunner("agy")).toBe(runHeadlessAgy);
  });

  test("returns runHeadlessClaude for backend claude", () => {
    expect(getAgentRunner("claude")).toBe(runHeadlessClaude);
  });

  test("throws for unknown backend", () => {
    expect(() => getAgentRunner("unknown" as any)).toThrow('Unknown agent backend: "unknown"');
  });
});

describe("AgentError", () => {
  test("sets isRateLimited on status 429", () => {
    const err = new AgentError("Too many requests", 429);
    expect(err.isRateLimited).toBe(true);
  });

  test("sets isRateLimited on rate limit message", () => {
    const err = new AgentError("User session limit reached");
    expect(err.isRateLimited).toBe(true);
  });

  test("does not set isRateLimited on generic error", () => {
    const err = new AgentError("Syntax error in file", 500);
    expect(err.isRateLimited).toBe(false);
  });
});
