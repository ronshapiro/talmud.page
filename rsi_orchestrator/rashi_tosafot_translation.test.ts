import {Edit} from "../precomputed/ai_edits";
import {AgentError} from "./agent_runner";
import {
  CritiqueOutcome,
  CritiqueVerdict,
  GeneratedEdit,
  generateWithSelfCritique,
  compareAmudim,
  filterSectionsFromStartPage,
  MAX_GENERATION_ATTEMPTS,
  parseJsonResponse,
  runContinuousTranslation,
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
    contextRefsUsed: [],
    ...overrides,
  };
}

function outcome(overrides: Partial<CritiqueOutcome> = {}): CritiqueOutcome {
  return {
    verdict: {valid: true, reason: "looks good"},
    costUsd: 0.002,
    contextRefsUsed: [],
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

  test("unions contextRefsUsed from the accepted generate and critique calls", async () => {
    const generate = jest.fn(async () => generated({contextRefsUsed: ["Zevachim 2a:1"]}));
    const critique = jest.fn(async () => outcome({
      contextRefsUsed: ["Zevachim 2a:1", "Rashi on Zevachim 2a:1:2"],
    }));
    const result = await generateWithSelfCritique(candidate(), {generate, critique});
    expect(result!.contextRefsUsed.sort()).toEqual(["Rashi on Zevachim 2a:1:2", "Zevachim 2a:1"]);
  });

  test("only counts the final accepted attempt's contextRefsUsed, not the rejected one's", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockResolvedValueOnce(generated({
        edit: {hebrew: "wrong"}, contextRefsUsed: ["Zevachim 2a:99"],
      }))
      .mockResolvedValueOnce(generated({contextRefsUsed: ["Zevachim 2a:1"]}));
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>()
      .mockResolvedValueOnce(outcome({verdict: invalidVerdict, contextRefsUsed: []}))
      .mockResolvedValueOnce(outcome({contextRefsUsed: []}));

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result!.contextRefsUsed).toEqual(["Zevachim 2a:1"]);
  });

  test(`retries up to ${MAX_GENERATION_ATTEMPTS} times, then gives up`, async () => {
    const generate = jest.fn(async () => generated({edit: {hebrew: "wrong"}}));
    const critique = jest.fn(async () => invalidOutcome);

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
    expect(critique).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
  });

  test("succeeds on the final allowed attempt rather than giving up early", async () => {
    const generate = jest.fn(async () => generated({edit: {hebrew: "wrong"}}));
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>();
    for (let i = 0; i < MAX_GENERATION_ATTEMPTS - 1; i++) {
      critique.mockResolvedValueOnce(invalidOutcome);
    }
    critique.mockResolvedValueOnce(validOutcome);

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
  });

  test("retries with feedback when generate throws (e.g. a malformed response), not just on a "
    + "rejected critique", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockRejectedValueOnce(new SyntaxError("Unexpected token"))
      .mockResolvedValueOnce(generated());
    const critique = jest.fn(async () => validOutcome);

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(critique).toHaveBeenCalledTimes(1); // not called for the attempt that threw
    expect(generate.mock.calls[1][1]).toContain("Unexpected token");
  });

  test("propagates a rate-limit error immediately instead of retrying", async () => {
    const rateLimitError = new AgentError("rate limited", 429, "claude");
    const generate = jest.fn(async () => { throw rateLimitError; });
    const critique = jest.fn(async () => validOutcome);

    await expect(generateWithSelfCritique(candidate(), {generate, critique}))
      .rejects.toBe(rateLimitError);
    expect(generate).toHaveBeenCalledTimes(1);
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
    expect(writeEdit).toHaveBeenCalledWith(candidate(), {...gen.edit, status: "pending"});
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
      .mockRejectedValueOnce(new AgentError("You've hit your session limit", 429, "claude"));
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
    const result = await translateRashiTosafotComments(fakeGenerationDeps({
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
    expect(result).toEqual({rateLimited: false, candidatesProcessed: 2});
  });

  test("returns rateLimited: true and the error when rate limit is encountered", async () => {
    const rateLimitErr = new AgentError("Resource exhausted", 429, "claude");
    const result = await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"})],
      generate: async () => { throw rateLimitErr; },
    }));
    expect(result).toEqual({
      rateLimited: true,
      rateLimitError: rateLimitErr,
      candidatesProcessed: 0,
    });
  });

  test("stops early when shouldStop returns true", async () => {
    const written: string[] = [];
    let count = 0;
    const result = await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      generate: async () => {
        count++;
        return generated();
      },
      writeEdit: (c) => written.push(c.ref),
      shouldStop: () => count >= 1,
    }));
    expect(written).toEqual(["a"]);
    expect(result).toEqual({
      rateLimited: false,
      candidatesProcessed: 1,
      stoppedDueToDeadline: true,
    });
  });
});

describe("runContinuousTranslation", () => {
  test("processes all candidates and stops with all_completed", async () => {
    const freshSet = new Set<string>();
    const written: string[] = [];
    const candidates = [candidate({ref: "a"}), candidate({ref: "b"})];
    let currentTime = 1000;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async () => generated(),
      writeEdit: (c) => {
        written.push(c.ref);
        freshSet.add(c.ref);
      },
      recordGeneration: () => {},
      durationMs: 24 * 60 * 60 * 1000,
      now: () => currentTime,
      sleep: async (ms) => { currentTime += ms; },
      logger: {log: () => {}, error: () => {}},
    });

    expect(written).toEqual(["a", "b"]);
    expect(summary).toEqual({
      totalProcessed: 2,
      totalPauses: 0,
      stoppedReason: "all_completed",
    });
  });

  test("exits immediately with all_completed if all candidates are already fresh", async () => {
    const onProgress = jest.fn();
    const summary = await runContinuousTranslation({
      listCandidates: () => [candidate({ref: "a"})],
      isFresh: () => true,
      generate: async () => generated(),
      writeEdit: () => {},
      recordGeneration: () => {},
      onProgress,
      durationMs: 24 * 60 * 60 * 1000,
      now: () => 1000,
      sleep: async () => {},
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 0,
      totalPauses: 0,
      stoppedReason: "all_completed",
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  test("stops with duration_elapsed when time limit is reached during execution", async () => {
    const freshSet = new Set<string>();
    const candidates = [candidate({ref: "a"}), candidate({ref: "b"}), candidate({ref: "c"})];
    let currentTime = 0;
    const durationMs = 1000;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async () => {
        currentTime += 1500; // First candidate takes 1500ms, pushing next past durationMs (1000ms)
        return generated();
      },
      writeEdit: c => freshSet.add(c.ref),
      recordGeneration: () => {},
      durationMs,
      now: () => currentTime,
      sleep: async (ms) => { currentTime += ms; },
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 1,
      totalPauses: 0,
      stoppedReason: "duration_elapsed",
    });
  });

  test("pauses hourly when quota exhausted, then resumes when available", async () => {
    const freshSet = new Set<string>();
    const candidates = [candidate({ref: "a"}), candidate({ref: "b"})];
    let currentTime = 0;
    const checkIntervalMs = 60 * 60 * 1000; // 1 hour
    const sleepCalls: number[] = [];
    const logs: string[] = [];
    const onProgress = jest.fn();

    let quotaAvailable = false;
    let generateAttempts = 0;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async (c) => {
        generateAttempts++;
        if (c.ref === "b" && !quotaAvailable) {
          throw new AgentError("Rate limit exceeded", 429, "claude");
        }
        return generated();
      },
      writeEdit: (c) => freshSet.add(c.ref),
      recordGeneration: () => {},
      onProgress,
      durationMs: 24 * 60 * 60 * 1000,
      checkIntervalMs,
      now: () => currentTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        currentTime += ms;
        // On waking after the 1st hourly sleep, quota has recovered!
        quotaAvailable = true;
      },
      logger: {
        log: (msg: string) => logs.push(msg),
        error: () => {},
      },
    });

    expect(summary).toEqual({
      totalProcessed: 2,
      totalPauses: 1,
      stoppedReason: "all_completed",
    });
    // Slept for 1 hour (3600000 ms)
    expect(sleepCalls).toEqual([3600000]);
    // Progress was committed after candidate "a", then on rate limit, then after candidate "b"
    expect(onProgress).toHaveBeenCalled();
    // Candidate "b" was attempted twice (once hit rate limit, once succeeded)
    expect(generateAttempts).toBe(3); // "a", "b" (failed), "b" (succeeded)
    expect(freshSet.has("a")).toBe(true);
    expect(freshSet.has("b")).toBe(true);
  });

  test("pauses multiple hourly checks if quota remains exhausted", async () => {
    const freshSet = new Set<string>();
    const candidates = [candidate({ref: "a"})];
    let currentTime = 0;
    const checkIntervalMs = 60 * 60 * 1000;
    const sleepCalls: number[] = [];

    let attempts = 0;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async () => {
        attempts++;
        if (attempts < 3) {
          throw new AgentError("quota exceeded", 429, "agy");
        }
        return generated();
      },
      writeEdit: c => freshSet.add(c.ref),
      recordGeneration: () => {},
      durationMs: 24 * 60 * 60 * 1000,
      checkIntervalMs,
      now: () => currentTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        currentTime += ms;
      },
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 1,
      totalPauses: 2,
      stoppedReason: "all_completed",
    });
    expect(sleepCalls).toEqual([3600000, 3600000]);
    expect(attempts).toBe(3);
    expect(freshSet.has("a")).toBe(true);
  });

  test("stops with duration_elapsed when duration expires while paused for quota", async () => {
    let currentTime = 0;
    const durationMs = 2 * 60 * 60 * 1000; // 2 hours
    const checkIntervalMs = 60 * 60 * 1000; // 1 hour
    const sleepCalls: number[] = [];

    const summary = await runContinuousTranslation({
      listCandidates: () => [candidate({ref: "a"})],
      isFresh: () => false,
      generate: async () => {
        throw new AgentError("quota exceeded", 429, "claude");
      },
      writeEdit: () => {},
      recordGeneration: () => {},
      durationMs,
      checkIntervalMs,
      now: () => currentTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        currentTime += ms;
      },
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 0,
      totalPauses: 2,
      stoppedReason: "duration_elapsed",
    });
    // Two 1-hour pauses hit the 2-hour duration limit
    expect(sleepCalls).toEqual([3600000, 3600000]);
  });
});

describe("filterSectionsFromStartPage", () => {
  const sections = ["2a", "2b", "3a", "3b", "10a", "10b", "11a"];

  test("filters from exact matching section", () => {
    expect(filterSectionsFromStartPage(sections, "10b")).toEqual(["10b", "11a"]);
  });

  test("normalizes integer page to daf 'a'", () => {
    expect(filterSectionsFromStartPage(sections, "10")).toEqual(["10a", "10b", "11a"]);
  });

  test("finds closest subsequent page when exact page not in list", () => {
    expect(filterSectionsFromStartPage(sections, "4a")).toEqual(["10a", "10b", "11a"]);
  });

  test("returns all sections when start page is before first section", () => {
    expect(filterSectionsFromStartPage(sections, "1a")).toEqual(sections);
  });

  test("returns empty array when start page is after all sections", () => {
    expect(filterSectionsFromStartPage(sections, "20a")).toEqual([]);
  });
});

describe("compareAmudim", () => {
  test("compares dafim numerically", () => {
    expect(compareAmudim("2b", "10a")).toBeLessThan(0);
    expect(compareAmudim("10a", "2b")).toBeGreaterThan(0);
  });

  test("compares amud 'a' and 'b' on same daf", () => {
    expect(compareAmudim("10a", "10b")).toBeLessThan(0);
    expect(compareAmudim("10b", "10a")).toBeGreaterThan(0);
    expect(compareAmudim("10a", "10a")).toBe(0);
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
