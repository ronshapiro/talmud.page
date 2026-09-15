import {
  commitAndPushPendingCandidates,
  CommitPendingDeps,
  makeRealCommitPendingDeps,
  mergeFileContent,
  parseStatusPaths,
  realCommitPendingDeps,
} from "./commit_pending";

describe("parseStatusPaths", () => {
  test("parses plain paths with no special characters", () => {
    expect(parseStatusPaths(" M precomputed/ai_additions/Zevachim.json")).toEqual(
      ["precomputed/ai_additions/Zevachim.json"]);
  });

  // git quotes any path containing a space (verified against a real repo) — every ai_additions
  // path does, since pages are named e.g. "Menachot 87a.json". Missing this parses the quotes
  // themselves as part of the path, which then fails to match any real file.
  test("un-quotes paths git quotes for containing a space", () => {
    expect(parseStatusPaths(' M "precomputed/ai_additions/Menachot 87a.json"')).toEqual(
      ["precomputed/ai_additions/Menachot 87a.json"]);
  });

  test("parses multiple lines, ignoring blank ones", () => {
    const statusOut = [
      ' M "precomputed/ai_additions/Menachot 87a.json"',
      '?? "precomputed/ai_additions/Menachot 87b.json"',
      "",
    ].join("\n");
    expect(parseStatusPaths(statusOut)).toEqual([
      "precomputed/ai_additions/Menachot 87a.json",
      "precomputed/ai_additions/Menachot 87b.json",
    ]);
  });
});

describe("mergeFileContent", () => {
  test("JSON files merge by key union, local winning on a duplicate ref", () => {
    const remote = JSON.stringify({"ref-a": {english: "remote a"}, "ref-b": {english: "b"}});
    const local = JSON.stringify({"ref-a": {english: "local a"}, "ref-c": {english: "c"}});

    const merged = JSON.parse(
      mergeFileContent("precomputed/ai_additions/Foo.json", remote, local));

    expect(merged).toEqual({
      "ref-a": {english: "local a"},
      "ref-b": {english: "b"},
      "ref-c": {english: "c"},
    });
  });

  test("JSON files with no remote content yet just take the local content", () => {
    const local = JSON.stringify({"ref-a": {english: "a"}});

    const merged = JSON.parse(
      mergeFileContent("precomputed/ai_additions/Foo.json", undefined, local));

    expect(merged).toEqual({"ref-a": {english: "a"}});
  });

  test("jsonl files merge by line union, keeping remote's lines first", () => {
    const remote = '{"ref":"a"}\n{"ref":"b"}\n';
    const local = '{"ref":"b"}\n{"ref":"c"}\n';

    const merged = mergeFileContent(
      "precomputed/rsi_state/context_usage_log.jsonl", remote, local);

    expect(merged).toEqual('{"ref":"a"}\n{"ref":"b"}\n{"ref":"c"}\n');
  });

  test("jsonl files with no remote content yet just take the local lines", () => {
    const local = '{"ref":"a"}\n{"ref":"b"}\n';

    const merged = mergeFileContent(
      "precomputed/rsi_state/context_usage_log.jsonl", undefined, local);

    expect(merged).toEqual('{"ref":"a"}\n{"ref":"b"}\n');
  });
});

function fakeDeps(overrides: Partial<CommitPendingDeps> = {}): CommitPendingDeps {
  return {
    gitStatusPorcelain: async () => " M precomputed/ai_additions/Zevachim 16a.json",
    currentBranch: async () => "rsi-feature-branch",
    findOpenPr: async () => undefined,
    commitPendingState: async (_message: string) => true,
    push: async () => {},
    openPr: async () => {},
    ...overrides,
  };
}

describe("commitAndPushPendingCandidates", () => {
  test("no-ops when nothing changed under the managed paths", async () => {
    const commitPendingState = jest.fn();
    await commitAndPushPendingCandidates("msg", fakeDeps({
      gitStatusPorcelain: async () => "",
      commitPendingState,
    }));

    expect(commitPendingState).not.toHaveBeenCalled();
  });

  test("throws error if run on base branch", async () => {
    await expect(commitAndPushPendingCandidates("msg", fakeDeps({
      currentBranch: async () => "base",
    }))).rejects.toThrow('Cannot commit pending candidates directly to "base"');
  });

  test("throws error if run on detached HEAD", async () => {
    await expect(commitAndPushPendingCandidates("msg", fakeDeps({
      currentBranch: async () => "HEAD",
    }))).rejects.toThrow('Cannot commit pending candidates directly to "HEAD"');
  });

  test("commits, pushes, and opens PR when none is open", async () => {
    const commitPendingState = jest.fn(async (_message: string) => true);
    const push = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("New candidates", fakeDeps({
      currentBranch: async () => "rsi-chullin",
      findOpenPr: async () => undefined,
      commitPendingState,
      push,
      openPr,
    }));

    expect(commitPendingState).toHaveBeenCalledWith("New candidates");
    expect(push).toHaveBeenCalled();
    expect(openPr).toHaveBeenCalledWith(
      "rsi-chullin", "New candidates", expect.any(String));
  });

  test("pushes onto the existing open PR's branch without opening a new PR", async () => {
    const commitPendingState = jest.fn(async (_message: string) => true);
    const push = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("More candidates", fakeDeps({
      currentBranch: async () => "rsi-chullin",
      findOpenPr: async () => ({number: 42}),
      commitPendingState,
      push,
      openPr,
    }));

    expect(commitPendingState).toHaveBeenCalledWith("More candidates");
    expect(push).toHaveBeenCalled();
    expect(openPr).not.toHaveBeenCalled();
  });

  test("does not push or open PR if worktree has nothing to commit", async () => {
    const push = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("No changes", fakeDeps({
      commitPendingState: async () => false,
      push,
      openPr,
    }));

    expect(push).not.toHaveBeenCalled();
    expect(openPr).not.toHaveBeenCalled();
  });
});

describe("makeRealCommitPendingDeps", () => {
  test("constructs an object satisfying CommitPendingDeps", () => {
    const deps = makeRealCommitPendingDeps({debug: true});
    expect(typeof deps.gitStatusPorcelain).toBe("function");
    expect(typeof deps.currentBranch).toBe("function");
    expect(typeof deps.findOpenPr).toBe("function");
    expect(typeof deps.commitPendingState).toBe("function");
    expect(typeof deps.push).toBe("function");
    expect(typeof deps.openPr).toBe("function");
  });

  test("realCommitPendingDeps is initialized with default options", () => {
    expect(typeof realCommitPendingDeps.gitStatusPorcelain).toBe("function");
  });
});
