import {
  AgentError,
  asAgyCliError,
  asClaudeCliError,
  getAgentRunner,
  parseAgyStreamJsonLines,
  parseClaudeStreamJsonLines,
  primaryClaudeModel,
  runHeadlessAgy,
  runHeadlessClaude,
} from "./agent_runner";

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

describe("primaryClaudeModel", () => {
  test("returns undefined when there's no modelUsage", () => {
    expect(primaryClaudeModel(undefined)).toBeUndefined();
  });

  test("returns undefined for an empty modelUsage", () => {
    expect(primaryClaudeModel({})).toBeUndefined();
  });

  test("returns the only model when there's just one", () => {
    expect(primaryClaudeModel({"claude-sonnet-5": {costUSD: 0.01}})).toBe("claude-sonnet-5");
  });

  test("picks the highest-cost model when several models were used in one session", () => {
    expect(primaryClaudeModel({
      "claude-haiku-4-5-20251001": {costUSD: 0.001142},
      "claude-sonnet-5": {costUSD: 0.14135159999999997},
    })).toBe("claude-sonnet-5");
  });

  test("treats a missing costUSD as zero", () => {
    expect(primaryClaudeModel({
      "claude-haiku-4-5-20251001": {},
      "claude-sonnet-5": {costUSD: 0.01},
    })).toBe("claude-sonnet-5");
  });
});

function assistantLine(toolUseBlocks: Array<{name: string; input: unknown}>): string {
  return JSON.stringify({
    type: "assistant",
    message: {
      content: toolUseBlocks.map(b => ({type: "tool_use", name: b.name, input: b.input})),
    },
  });
}

function textAssistantLine(text: string): string {
  return JSON.stringify({type: "assistant", message: {content: [{type: "text", text}]}});
}

function resultLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "result", is_error: false, result: "done", total_cost_usd: 0.05, ...overrides,
  });
}

describe("parseClaudeStreamJsonLines", () => {
  test("returns no tool uses and no result for an empty stream", () => {
    expect(parseClaudeStreamJsonLines("")).toEqual({toolUses: [], result: undefined});
  });

  test("collects tool_use blocks from assistant lines, in order", () => {
    const stdout = [
      JSON.stringify({type: "system", subtype: "init"}),
      assistantLine([{name: "Read", input: {file_path: "a.json"}}]),
      JSON.stringify({type: "user", message: {content: []}}),
      assistantLine([{name: "Grep", input: {pattern: "Rashi"}}]),
      textAssistantLine("done"),
      resultLine(),
    ].join("\n");

    const {toolUses, result} = parseClaudeStreamJsonLines(stdout);
    expect(toolUses).toEqual([
      {name: "Read", input: {file_path: "a.json"}},
      {name: "Grep", input: {pattern: "Rashi"}},
    ]);
    expect(result?.result).toBe("done");
  });

  test("ignores a trailing partial/non-JSON line", () => {
    const stdout = `${resultLine()}\n{"type": "assistant", truncated`;
    expect(parseClaudeStreamJsonLines(stdout).result?.result).toBe("done");
  });

  test("returns undefined result when no result line is present", () => {
    const stdout = assistantLine([{name: "Read", input: {file_path: "a.json"}}]);
    expect(parseClaudeStreamJsonLines(stdout).result).toBeUndefined();
  });
});

describe("asClaudeCliError", () => {
  test("returns undefined when the error has no stdout", () => {
    expect(asClaudeCliError(new Error("boom"))).toBeUndefined();
  });

  test("returns undefined when stdout has no result line", () => {
    expect(asClaudeCliError({stdout: "not json"})).toBeUndefined();
  });

  test("recovers an AgentError from a rate-limited response on stdout", () => {
    const stdout = resultLine({
      is_error: true,
      result: "You've hit your session limit · resets 6:10pm",
      api_error_status: 429,
    });
    const recovered = asClaudeCliError({stdout});
    expect(recovered).toBeInstanceOf(AgentError);
    expect(recovered!.isRateLimited).toBe(true);
    expect(recovered!.backend).toBe("claude");
    expect(recovered!.message).toBe("You've hit your session limit · resets 6:10pm");
  });

  test("a non-429 CLI error is not treated as rate-limited", () => {
    const stdout = resultLine({is_error: true, result: "boom", api_error_status: 500});
    expect(asClaudeCliError({stdout})!.isRateLimited).toBe(false);
  });

  test("recovers the error even with preceding assistant/tool-use lines on stdout", () => {
    const stdout = [
      assistantLine([{name: "Read", input: {file_path: "a.json"}}]),
      resultLine({is_error: true, result: "boom", api_error_status: 429}),
    ].join("\n");
    expect(asClaudeCliError({stdout})!.isRateLimited).toBe(true);
  });
});
