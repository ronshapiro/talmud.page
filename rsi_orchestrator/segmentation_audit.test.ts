import * as fs from "fs";
import * as path from "path";
import {Amud} from "../apiTypes";
import {Book} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {upsertGenerationRecord} from "../precomputed/rsi_state/generation_record";
import {writeJson} from "../util/json_files";
import {HeadlessClaudeError} from "./headless_claude";
import {
  AuditDeps,
  dropSuggestionsWithUnknownRefs,
  GeneratedAudit,
  isFreshAudit,
  listCandidatesForBook,
  runSegmentationAudit,
  SegmentationAuditCandidate,
  TASK_TYPE,
} from "./segmentation_audit";

const TEST_BOOK = {
  canonicalName: "__Test_Book__", sections: new Set(["2a", "2b"]),
} as unknown as Book;

function amud(overrides: Partial<Amud> = {}): Amud {
  return {
    id: "__Test_Book__ 2a",
    sections: [
      {
        ref: "__Test_Book__ 2a:1",
        he: "ראשון",
        en: "first",
        commentary: {
          Rashi: {comments: [{
            ref: "Rashi on __Test_Book__ 2a:1:1",
            he: "א",
            en: "a",
            sourceRef: "__Test_Book__ 2a:1",
            sourceHeRef: "__Test_Book__ 2a:1",
          }]},
          Tosafot: {comments: [{
            ref: "Tosafot on __Test_Book__ 2a:1:1",
            he: "ב",
            en: "b",
            sourceRef: "__Test_Book__ 2a:1",
            sourceHeRef: "__Test_Book__ 2a:1",
          }]},
          // Not Rashi/Tosafot — shouldn't appear in the boundary fingerprint or valid-refs set.
          Steinsaltz: {comments: [{
            ref: "Steinsaltz on __Test_Book__ 2a:1:1",
            he: "ג",
            en: "c",
            sourceRef: "__Test_Book__ 2a:1",
            sourceHeRef: "__Test_Book__ 2a:1",
          }]},
        },
      },
      {ref: "__Test_Book__ 2a:2", he: "שני", en: "second"},
    ],
    ...overrides,
  };
}

const filePath2a = cachedOutputFilePath(TEST_BOOK, "2a");
const filePath2b = cachedOutputFilePath(TEST_BOOK, "2b");

beforeAll(() => {
  fs.mkdirSync(path.dirname(filePath2a), {recursive: true});
});

afterEach(() => {
  fs.rmSync(filePath2a, {force: true});
  fs.rmSync(filePath2b, {force: true});
  fs.rmSync(`precomputed/rsi_state/generation_records/${TASK_TYPE}`, {recursive: true, force: true});
});

describe("listCandidatesForBook", () => {
  test("skips sections with no cached file", () => {
    expect(listCandidatesForBook(TEST_BOOK)).toEqual([]);
  });

  test("builds a candidate per cached section, with a boundary fingerprint", () => {
    writeJson(filePath2a, amud());
    const candidates = listCandidatesForBook(TEST_BOOK);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].page).toEqual("__Test_Book__ 2a");
    expect(candidates[0].boundaryFingerprint.split("|")).toEqual([
      "__Test_Book__ 2a:1",
      "Rashi on __Test_Book__ 2a:1:1",
      "Tosafot on __Test_Book__ 2a:1:1",
      "__Test_Book__ 2a:2",
    ]);
  });

  test("excludes non-Rashi/Tosafot commentary from the fingerprint", () => {
    writeJson(filePath2a, amud());
    const [built] = listCandidatesForBook(TEST_BOOK);
    expect(built.boundaryFingerprint).not.toContain("Steinsaltz");
  });
});

function candidate(
  overrides: Partial<SegmentationAuditCandidate> = {},
): SegmentationAuditCandidate {
  return {
    page: "__Test_Book__ 2a",
    book: "__Test_Book__",
    section: "2a",
    boundaryFingerprint: "__Test_Book__ 2a:1|Rashi on __Test_Book__ 2a:1:1",
    ...overrides,
  };
}

describe("isFreshAudit", () => {
  test("false when there's no generation record yet", () => {
    expect(isFreshAudit(candidate())).toBe(false);
  });

  test("true when the boundary fingerprint hasn't changed", () => {
    upsertGenerationRecord(TASK_TYPE, "__Test_Book__ 2a", "__Test_Book__ 2a", {
      sourceRefs: ["__Test_Book__ 2a"],
      sourceText: candidate().boundaryFingerprint,
      model: "claude-sonnet-5",
      promptVersion: "v1",
      generatedAt: new Date().toISOString(),
      dependsOn: [],
    });
    expect(isFreshAudit(candidate())).toBe(true);
  });

  test("false when the boundary fingerprint changed (a boundary actually moved)", () => {
    upsertGenerationRecord(TASK_TYPE, "__Test_Book__ 2a", "__Test_Book__ 2a", {
      sourceRefs: ["__Test_Book__ 2a"],
      sourceText: "__Test_Book__ 2a:1|__Test_Book__ 2a:2|__Test_Book__ 2a:3", // extra segment
      model: "claude-sonnet-5",
      promptVersion: "v1",
      generatedAt: new Date().toISOString(),
      dependsOn: [],
    });
    expect(isFreshAudit(candidate())).toBe(false);
  });
});

describe("dropSuggestionsWithUnknownRefs", () => {
  test("keeps a suggestion whose refs are all real", () => {
    const result = dropSuggestionsWithUnknownRefs(candidate(), {
      suggestions: [{
        refs: ["Rashi on __Test_Book__ 2a:1:1"], issue: "x", suggestion: "y",
      }],
    });
    expect(result.suggestions).toHaveLength(1);
  });

  test("drops a suggestion referencing a ref not on the page", () => {
    const result = dropSuggestionsWithUnknownRefs(candidate(), {
      suggestions: [{refs: ["Rashi on __Test_Book__ 2a:99:1"], issue: "x", suggestion: "y"}],
    });
    expect(result.suggestions).toEqual([]);
  });

  test("drops a suggestion only if any one of its refs is unknown", () => {
    const result = dropSuggestionsWithUnknownRefs(candidate(), {
      suggestions: [{
        refs: ["__Test_Book__ 2a:1", "hallucinated ref"], issue: "x", suggestion: "y",
      }],
    });
    expect(result.suggestions).toEqual([]);
  });

  test("keeps other valid suggestions when one is dropped", () => {
    const result = dropSuggestionsWithUnknownRefs(candidate(), {
      suggestions: [
        {refs: ["bogus"], issue: "x", suggestion: "y"},
        {refs: ["__Test_Book__ 2a:1"], issue: "a", suggestion: "b"},
      ],
    });
    expect(result.suggestions).toEqual([{refs: ["__Test_Book__ 2a:1"], issue: "a", suggestion: "b"}]);
  });
});

function generated(overrides: Partial<GeneratedAudit> = {}): GeneratedAudit {
  return {
    result: {suggestions: []},
    model: "claude-sonnet-5",
    costUsd: 0.01,
    contextRefsUsed: [],
    ...overrides,
  };
}

function fakeDeps(overrides: Partial<AuditDeps> = {}): AuditDeps {
  return {
    listCandidates: () => [],
    isFresh: () => false,
    generate: async () => generated(),
    writeSuggestions: () => {},
    recordGeneration: () => {},
    ...overrides,
  };
}

describe("runSegmentationAudit", () => {
  test("does nothing when there are no candidates", async () => {
    const writeSuggestions = jest.fn();
    await runSegmentationAudit(fakeDeps({listCandidates: () => [], writeSuggestions}));
    expect(writeSuggestions).not.toHaveBeenCalled();
  });

  test("skips a fresh candidate", async () => {
    const generate = jest.fn();
    await runSegmentationAudit(fakeDeps({
      listCandidates: () => [candidate()],
      isFresh: () => true,
      generate,
    }));
    expect(generate).not.toHaveBeenCalled();
  });

  test("writes and records for a non-fresh candidate", async () => {
    const writeSuggestions = jest.fn();
    const recordGeneration = jest.fn();
    const gen = generated();
    await runSegmentationAudit(fakeDeps({
      listCandidates: () => [candidate()],
      generate: async () => gen,
      writeSuggestions,
      recordGeneration,
    }));
    expect(writeSuggestions).toHaveBeenCalledWith(candidate(), gen.result);
    expect(recordGeneration).toHaveBeenCalledWith(candidate(), gen);
  });

  test("stops the whole run when generate hits a rate limit, without writing", async () => {
    const writeSuggestions = jest.fn();
    const generate = jest.fn()
      .mockRejectedValueOnce(new HeadlessClaudeError("You've hit your session limit", 429));
    await runSegmentationAudit(fakeDeps({
      listCandidates: () => [candidate({page: "a"}), candidate({page: "b"})],
      generate,
      writeSuggestions,
    }));
    expect(generate).toHaveBeenCalledTimes(1);
    expect(writeSuggestions).not.toHaveBeenCalled();
  });

  test("skips a candidate on a non-rate-limit error and continues to the next", async () => {
    const written: string[] = [];
    await runSegmentationAudit(fakeDeps({
      listCandidates: () => [candidate({page: "a"}), candidate({page: "b"})],
      generate: async c => {
        if (c.page === "a") throw new Error("transient CLI failure");
        return generated();
      },
      writeSuggestions: c => written.push(c.page),
    }));
    expect(written).toEqual(["b"]);
  });
});
