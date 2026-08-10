import {asCliError, HeadlessClaudeError, primaryModel} from "./headless_claude";

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

describe("asCliError", () => {
  test("returns undefined when the error has no stdout", () => {
    expect(asCliError(new Error("boom"))).toBeUndefined();
  });

  test("returns undefined when stdout isn't valid JSON", () => {
    expect(asCliError({stdout: "not json"})).toBeUndefined();
  });

  test("recovers a HeadlessClaudeError from a rate-limited response on stdout", () => {
    const stdout = JSON.stringify({
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
    const stdout = JSON.stringify({is_error: true, result: "boom", api_error_status: 500});
    expect(asCliError({stdout})!.isRateLimited).toBe(false);
  });
});
