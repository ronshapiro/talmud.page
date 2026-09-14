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

    const merged = JSON.parse(mergeFileContent("precomputed/ai_additions/Foo.json", remote, local));

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

    const merged = mergeFileContent("precomputed/rsi_state/context_usage_log.jsonl", remote, local);

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
    findOpenPr: async () => undefined,
    createWorktree: async (_targetRef: string) => "/tmp/fake-worktree",
    removeWorktree: async () => {},
    mergeAndWriteFiles: async () => {},
    commitPendingState: async () => true,
    push: async () => {},
    openPr: async () => {},
    ...overrides,
  };
}

describe("commitAndPushPendingCandidates", () => {
  test("no-ops when nothing changed under the managed paths", async () => {
    const createWorktree = jest.fn();
    const commitPendingState = jest.fn();
    await commitAndPushPendingCandidates("msg", fakeDeps({
      gitStatusPorcelain: async () => "",
      createWorktree,
      commitPendingState,
    }));

    expect(createWorktree).not.toHaveBeenCalled();
    expect(commitPendingState).not.toHaveBeenCalled();
  });

  test("opens a fresh branch+PR when none is open", async () => {
    const createWorktree = jest.fn(async (_targetRef: string) => "/tmp/fake-worktree");
    const removeWorktree = jest.fn();
    const mergeAndWriteFiles = jest.fn();
    const openPr = jest.fn();
    const commitPendingState = jest.fn(
      async (_worktreeDir: string, _message: string) => true);
    const push = jest.fn();
    await commitAndPushPendingCandidates("New candidates", fakeDeps({
      findOpenPr: async () => undefined,
      createWorktree,
      removeWorktree,
      mergeAndWriteFiles,
      commitPendingState,
      push,
      openPr,
    }));

    expect(createWorktree).toHaveBeenCalledWith("base");
    expect(mergeAndWriteFiles).toHaveBeenCalledWith(
      "/tmp/fake-worktree", ["precomputed/ai_additions/Zevachim 16a.json"]);
    expect(commitPendingState).toHaveBeenCalledWith("/tmp/fake-worktree", "New candidates");
    expect(push).toHaveBeenCalledWith("/tmp/fake-worktree", "rsi-pending-candidates");
    expect(openPr).toHaveBeenCalledWith(
      "rsi-pending-candidates", expect.any(String), expect.any(String));
    expect(removeWorktree).toHaveBeenCalledWith("/tmp/fake-worktree");
  });

  test("merges onto the existing open PR's branch instead of opening a new one", async () => {
    const createWorktree = jest.fn(async (_targetRef: string) => "/tmp/fake-worktree");
    const removeWorktree = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("More candidates", fakeDeps({
      findOpenPr: async () => ({number: 42}),
      createWorktree,
      removeWorktree,
      openPr,
    }));

    expect(createWorktree).toHaveBeenCalledWith("rsi-pending-candidates");
    expect(openPr).not.toHaveBeenCalled();
    expect(removeWorktree).toHaveBeenCalledWith("/tmp/fake-worktree");
  });

  test("does not push or open PR if worktree has nothing to commit", async () => {
    const createWorktree = jest.fn(async (_targetRef: string) => "/tmp/fake-worktree");
    const removeWorktree = jest.fn();
    const push = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("No changes", fakeDeps({
      createWorktree,
      removeWorktree,
      commitPendingState: async () => false,
      push,
      openPr,
    }));

    expect(push).not.toHaveBeenCalled();
    expect(openPr).not.toHaveBeenCalled();
    expect(removeWorktree).toHaveBeenCalledWith("/tmp/fake-worktree");
  });

  test("always removes worktree even if commit or push throws", async () => {
    const removeWorktree = jest.fn();
    await expect(commitAndPushPendingCandidates("msg", fakeDeps({
      createWorktree: async (_targetRef: string) => "/tmp/fake-worktree",
      removeWorktree,
      commitPendingState: async () => {
        throw new Error("commit failed");
      },
    }))).rejects.toThrow("commit failed");

    expect(removeWorktree).toHaveBeenCalledWith("/tmp/fake-worktree");
  });
});

describe("makeRealCommitPendingDeps", () => {
  test("constructs an object satisfying CommitPendingDeps", () => {
    const deps = makeRealCommitPendingDeps({debug: true});
    expect(typeof deps.gitStatusPorcelain).toBe("function");
    expect(typeof deps.findOpenPr).toBe("function");
    expect(typeof deps.createWorktree).toBe("function");
    expect(typeof deps.removeWorktree).toBe("function");
    expect(typeof deps.mergeAndWriteFiles).toBe("function");
    expect(typeof deps.commitPendingState).toBe("function");
    expect(typeof deps.push).toBe("function");
    expect(typeof deps.openPr).toBe("function");
  });

  test("realCommitPendingDeps is initialized with default options", () => {
    expect(typeof realCommitPendingDeps.gitStatusPorcelain).toBe("function");
  });
});
