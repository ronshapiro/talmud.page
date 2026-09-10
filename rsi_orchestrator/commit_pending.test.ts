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
    checkoutNewBranch: async () => {},
    mergeLocalChangesOnto: async () => {},
    commitPendingState: async () => {},
    push: async () => {},
    openPr: async () => {},
    checkout: async () => {},
    ...overrides,
  };
}

describe("commitAndPushPendingCandidates", () => {
  test("no-ops when nothing changed under the managed paths", async () => {
    const checkoutNewBranch = jest.fn();
    const commitPendingState = jest.fn();
    await commitAndPushPendingCandidates("msg", fakeDeps({
      gitStatusPorcelain: async () => "",
      checkoutNewBranch,
      commitPendingState,
    }));

    expect(checkoutNewBranch).not.toHaveBeenCalled();
    expect(commitPendingState).not.toHaveBeenCalled();
  });

  test("opens a fresh branch+PR when none is open", async () => {
    const checkoutNewBranch = jest.fn();
    const mergeLocalChangesOnto = jest.fn();
    const openPr = jest.fn();
    const commitPendingState = jest.fn();
    const push = jest.fn();
    const checkout = jest.fn();
    await commitAndPushPendingCandidates("New candidates", fakeDeps({
      findOpenPr: async () => undefined,
      checkoutNewBranch,
      mergeLocalChangesOnto,
      commitPendingState,
      push,
      openPr,
      checkout,
    }));

    expect(checkoutNewBranch).toHaveBeenCalledWith("rsi-pending-candidates", "base");
    expect(mergeLocalChangesOnto).not.toHaveBeenCalled();
    expect(commitPendingState).toHaveBeenCalledWith("New candidates");
    expect(push).toHaveBeenCalledWith("rsi-pending-candidates");
    expect(openPr).toHaveBeenCalledWith(
      "rsi-pending-candidates", expect.any(String), expect.any(String));
    expect(checkout).toHaveBeenCalledWith("base");
  });

  test("merges onto the existing open PR's branch instead of opening a new one", async () => {
    const checkoutNewBranch = jest.fn();
    const mergeLocalChangesOnto = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("More candidates", fakeDeps({
      findOpenPr: async () => ({number: 42}),
      checkoutNewBranch,
      mergeLocalChangesOnto,
      openPr,
    }));

    expect(mergeLocalChangesOnto).toHaveBeenCalledWith("rsi-pending-candidates");
    expect(checkoutNewBranch).not.toHaveBeenCalled();
    expect(openPr).not.toHaveBeenCalled();
  });

  test("always returns to base afterward, even when reusing an open PR", async () => {
    const checkout = jest.fn();
    await commitAndPushPendingCandidates("msg", fakeDeps({
      findOpenPr: async () => ({number: 42}),
      checkout,
    }));

    expect(checkout).toHaveBeenCalledWith("base");
  });
});

describe("makeRealCommitPendingDeps", () => {
  test("constructs an object satisfying CommitPendingDeps", () => {
    const deps = makeRealCommitPendingDeps({debug: true});
    expect(typeof deps.gitStatusPorcelain).toBe("function");
    expect(typeof deps.findOpenPr).toBe("function");
    expect(typeof deps.checkoutNewBranch).toBe("function");
    expect(typeof deps.mergeLocalChangesOnto).toBe("function");
    expect(typeof deps.commitPendingState).toBe("function");
    expect(typeof deps.push).toBe("function");
    expect(typeof deps.openPr).toBe("function");
    expect(typeof deps.checkout).toBe("function");
  });

  test("realCommitPendingDeps is initialized with default options", () => {
    expect(typeof realCommitPendingDeps.gitStatusPorcelain).toBe("function");
  });
});
