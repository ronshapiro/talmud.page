import {Edit} from "../precomputed/ai_edits";
import {HeadlessClaudeError} from "./headless_claude";
import {
  CritiqueOutcome,
  CritiqueVerdict,
  GeneratedEdit,
  generateWithSelfCritique,
  parseJsonResponse,
  TranslationCandidate,
  TranslationDeps,
  translateRashiTosafotComments,
} from "./rashi_tosafot_translation";

function candidate(overrides: Partial<TranslationCandidate> = {}): TranslationCandidate {
  return {
    page: "Zevachim 2a",
    book: "Zevachim",
    section: "2a",
    ref: "Rashi on Zevachim 2a:1:1",
    commentator: "Rashi",
    hebrewSource: "מקור",
    ...overrides,
  };
}

function generated(overrides: Partial<GeneratedEdit> = {}): GeneratedEdit {
  return {
    edit: {hebrew: "מקור.", english: "source"},
    model: "claude-sonnet-5",
    costUsd: 0.01,
    ...overrides,
  };
}

function outcome(overrides: Partial<CritiqueOutcome> = {}): CritiqueOutcome {
  return {
    verdict: {valid: true, reason: "looks good"},
    costUsd: 0.002,
    ...overrides,
  };
}

const validOutcome = outcome();
const invalidVerdict: CritiqueVerdict = {valid: false, reason: "changed a word"};
const invalidOutcome = outcome({verdict: invalidVerdict});

describe("generateWithSelfCritique", () => {
  test("returns the edit when the first critique passes", async () => {
    const generate = jest.fn(async () => generated());
    const critique = jest.fn(async () => validOutcome);
    const result = await generateWithSelfCritique(candidate(), {generate, critique});
    // costUsd is the sum of the generate + critique calls (0.01 + 0.002), not just generate's own.
    expect(result).toEqual(generated({costUsd: 0.012}));
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("sums cost across the generate and critique calls", async () => {
    const generate = jest.fn(async () => generated({costUsd: 0.03}));
    const critique = jest.fn(async () => outcome({costUsd: 0.005}));
    const result = await generateWithSelfCritique(candidate(), {generate, critique});
    expect(result!.costUsd).toBeCloseTo(0.035);
  });

  test("retries once with feedback when the first critique fails, then succeeds", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockResolvedValueOnce(generated({edit: {hebrew: "wrong", english: "wrong"}, costUsd: 0.01}))
      .mockResolvedValueOnce(generated({costUsd: 0.01}));
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>()
      .mockResolvedValueOnce(outcome({verdict: invalidVerdict, costUsd: 0.002}))
      .mockResolvedValueOnce(outcome({costUsd: 0.002}));

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).toEqual(generated({costUsd: 0.024}));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]).toEqual([candidate(), invalidVerdict.reason]);
  });

  test("gives up after a second failed critique, without a third attempt", async () => {
    const generate = jest.fn(async () => generated({edit: {hebrew: "wrong"}}));
    const critique = jest.fn(async () => invalidOutcome);

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(critique).toHaveBeenCalledTimes(2);
  });
});

function fakeGenerationDeps(overrides: Partial<TranslationDeps> = {}): TranslationDeps {
  return {
    listCandidates: () => [],
    isFresh: () => false,
    generate: async () => generated(),
    writeEdit: () => {},
    recordGeneration: () => {},
    ...overrides,
  };
}

describe("translateRashiTosafotComments", () => {
  test("does nothing when there are no candidates", async () => {
    const writeEdit = jest.fn();
    await translateRashiTosafotComments(fakeGenerationDeps({listCandidates: () => [], writeEdit}));
    expect(writeEdit).not.toHaveBeenCalled();
  });

  test("skips a fresh candidate", async () => {
    const generate = jest.fn();
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate()],
      isFresh: () => true,
      generate,
    }));
    expect(generate).not.toHaveBeenCalled();
  });

  test("writes and records a generated edit for a non-fresh candidate", async () => {
    const writeEdit = jest.fn();
    const recordGeneration = jest.fn();
    const gen = generated();
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate()],
      isFresh: () => false,
      generate: async () => gen,
      writeEdit,
      recordGeneration,
    }));
    expect(writeEdit).toHaveBeenCalledWith(candidate(), gen.edit);
    expect(recordGeneration).toHaveBeenCalledWith(candidate(), gen);
  });

  test("skips writing when generate gives up (returns undefined)", async () => {
    const writeEdit = jest.fn();
    const recordGeneration = jest.fn();
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate()],
      generate: async () => undefined,
      writeEdit,
      recordGeneration,
    }));
    expect(writeEdit).not.toHaveBeenCalled();
    expect(recordGeneration).not.toHaveBeenCalled();
  });

  test("stops the whole run when generate hits a rate limit, without writing", async () => {
    const writeEdit = jest.fn();
    const generate = jest.fn()
      .mockRejectedValueOnce(new HeadlessClaudeError("You've hit your session limit", 429));
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      generate,
      writeEdit,
    }));
    expect(generate).toHaveBeenCalledTimes(1); // never reached candidate "b"
    expect(writeEdit).not.toHaveBeenCalled();
  });

  test("skips a candidate on a non-rate-limit error and continues to the next", async () => {
    const written: string[] = [];
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      generate: async (c) => {
        if (c.ref === "a") throw new Error("transient CLI failure");
        return generated();
      },
      writeEdit: (c) => written.push(c.ref),
    }));
    expect(written).toEqual(["b"]);
  });

  test("processes multiple candidates independently", async () => {
    const written: string[] = [];
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [
        candidate({ref: "a"}),
        candidate({ref: "b"}),
        candidate({ref: "c"}),
      ],
      isFresh: (c) => c.ref === "b",
      generate: async () => generated(),
      writeEdit: (c) => written.push(c.ref),
    }));
    expect(written).toEqual(["a", "c"]);
  });
});

describe("parseJsonResponse", () => {
  test("parses plain JSON", () => {
    expect(parseJsonResponse<{a: number}>('{"a": 1}')).toEqual({a: 1});
  });

  test("strips a surrounding markdown code fence", () => {
    expect(parseJsonResponse<{a: number}>('```json\n{"a": 1}\n```')).toEqual({a: 1});
  });

  test("strips a code fence with no language tag", () => {
    expect(parseJsonResponse<{a: number}>('```\n{"a": 1}\n```')).toEqual({a: 1});
  });
});
