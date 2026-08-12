import {asCliError, HeadlessClaudeError, parseStreamJsonLines, primaryModel} from "./headless_claude";

describe("primaryModel", () => {
  test("returns undefined when there's no modelUsage", () => {
    expect(primaryModel(undefined)).toBeUndefined();
  });

  test("returns undefined for an empty modelUsage", () => {
    expect(primaryModel({})).toBeUndefined();
  });

  test("returns the only model when there's just one", () => {
    expect(primaryModel({"claude-sonnet-5": {costUSD: 0.01}})).toBe("claude-sonnet-5");
  });

  test("picks the highest-cost model when several models were used in one session", () => {
    // A cheap sub-step on one model alongside the model that did the real generation work — the
    // real work should win, not whichever key happened to be inserted first.
    expect(primaryModel({
      "claude-haiku-4-5-20251001": {costUSD: 0.001142},
      "claude-sonnet-5": {costUSD: 0.14135159999999997},
    })).toBe("claude-sonnet-5");
  });

  test("treats a missing costUSD as zero", () => {
    expect(primaryModel({
      "claude-haiku-4-5-20251001": {},
      "claude-sonnet-5": {costUSD: 0.01},
    })).toBe("claude-sonnet-5");
  });
});

// Line shapes below are trimmed to just the fields parseStreamJsonLines actually reads, taken
// from a real `claude -p ... --output-format stream-json --verbose` capture.
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

describe("parseStreamJsonLines", () => {
  test("returns no tool uses and no result for an empty stream", () => {
    expect(parseStreamJsonLines("")).toEqual({toolUses: [], result: undefined});
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

    const {toolUses, result} = parseStreamJsonLines(stdout);
    expect(toolUses).toEqual([
      {name: "Read", input: {file_path: "a.json"}},
      {name: "Grep", input: {pattern: "Rashi"}},
    ]);
    expect(result?.result).toBe("done");
  });

  test("ignores a trailing partial/non-JSON line", () => {
    const stdout = `${resultLine()}\n{"type": "assistant", truncated`;
    expect(parseStreamJsonLines(stdout).result?.result).toBe("done");
  });

  test("returns undefined result when no result line is present", () => {
    const stdout = assistantLine([{name: "Read", input: {file_path: "a.json"}}]);
    expect(parseStreamJsonLines(stdout).result).toBeUndefined();
  });
});

describe("asCliError", () => {
  test("returns undefined when the error has no stdout", () => {
    expect(asCliError(new Error("boom"))).toBeUndefined();
  });

  test("returns undefined when stdout has no result line", () => {
    expect(asCliError({stdout: "not json"})).toBeUndefined();
  });

  test("recovers a HeadlessClaudeError from a rate-limited response on stdout", () => {
    const stdout = resultLine({
      is_error: true,
      result: "You've hit your session limit · resets 6:10pm",
      api_error_status: 429,
    });
    const recovered = asCliError({stdout});
    expect(recovered).toBeInstanceOf(HeadlessClaudeError);
    expect(recovered!.isRateLimited).toBe(true);
    expect(recovered!.message).toBe("You've hit your session limit · resets 6:10pm");
  });

  test("a non-429 CLI error is not treated as rate-limited", () => {
    const stdout = resultLine({is_error: true, result: "boom", api_error_status: 500});
    expect(asCliError({stdout})!.isRateLimited).toBe(false);
  });

  test("recovers the error even with preceding assistant/tool-use lines on stdout", () => {
    const stdout = [
      assistantLine([{name: "Read", input: {file_path: "a.json"}}]),
      resultLine({is_error: true, result: "boom", api_error_status: 429}),
    ].join("\n");
    expect(asCliError({stdout})!.isRateLimited).toBe(true);
  });
});
