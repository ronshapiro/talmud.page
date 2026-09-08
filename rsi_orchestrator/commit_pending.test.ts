import {commitAndPushPendingCandidates, CommitPendingDeps, parseStatusPaths} from "./commit_pending";

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

function fakeDeps(overrides: Partial<CommitPendingDeps> = {}): CommitPendingDeps {
  return {
    gitStatusPorcelain: async () => " M precomputed/ai_additions/Zevachim 16a.json",
    findOpenPr: async () => undefined,
    checkoutNewBranch: async () => {},
    mergeLocalAiAdditionsOnto: async () => {},
    commitAiAdditions: async () => {},
    push: async () => {},
    openPr: async () => {},
    checkout: async () => {},
    ...overrides,
  };
}

describe("commitAndPushPendingCandidates", () => {
  test("no-ops when nothing changed under ai_additions", async () => {
    const checkoutNewBranch = jest.fn();
    const commitAiAdditions = jest.fn();
    await commitAndPushPendingCandidates("msg", fakeDeps({
      gitStatusPorcelain: async () => "",
      checkoutNewBranch,
      commitAiAdditions,
    }));

    expect(checkoutNewBranch).not.toHaveBeenCalled();
    expect(commitAiAdditions).not.toHaveBeenCalled();
  });

  test("opens a fresh branch+PR when none is open", async () => {
    const checkoutNewBranch = jest.fn();
    const mergeLocalAiAdditionsOnto = jest.fn();
    const openPr = jest.fn();
    const commitAiAdditions = jest.fn();
    const push = jest.fn();
    const checkout = jest.fn();
    await commitAndPushPendingCandidates("New candidates", fakeDeps({
      findOpenPr: async () => undefined,
      checkoutNewBranch,
      mergeLocalAiAdditionsOnto,
      commitAiAdditions,
      push,
      openPr,
      checkout,
    }));

    expect(checkoutNewBranch).toHaveBeenCalledWith("rsi-pending-candidates", "base");
    expect(mergeLocalAiAdditionsOnto).not.toHaveBeenCalled();
    expect(commitAiAdditions).toHaveBeenCalledWith("New candidates");
    expect(push).toHaveBeenCalledWith("rsi-pending-candidates");
    expect(openPr).toHaveBeenCalledWith(
      "rsi-pending-candidates", expect.any(String), expect.any(String));
    expect(checkout).toHaveBeenCalledWith("base");
  });

  test("merges onto the existing open PR's branch instead of opening a new one", async () => {
    const checkoutNewBranch = jest.fn();
    const mergeLocalAiAdditionsOnto = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("More candidates", fakeDeps({
      findOpenPr: async () => ({number: 42}),
      checkoutNewBranch,
      mergeLocalAiAdditionsOnto,
      openPr,
    }));

    expect(mergeLocalAiAdditionsOnto).toHaveBeenCalledWith("rsi-pending-candidates");
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
