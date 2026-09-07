import {commitAndPushPendingCandidates, CommitPendingDeps} from "./commit_pending";

function fakeDeps(overrides: Partial<CommitPendingDeps> = {}): CommitPendingDeps {
  return {
    gitStatusPorcelain: async () => " M precomputed/ai_additions/Zevachim 16a.json",
    findOpenPr: async () => undefined,
    checkoutNewBranch: async () => {},
    checkoutExistingBranch: async () => {},
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
    const checkoutExistingBranch = jest.fn();
    const openPr = jest.fn();
    const commitAiAdditions = jest.fn();
    const push = jest.fn();
    const checkout = jest.fn();
    await commitAndPushPendingCandidates("New candidates", fakeDeps({
      findOpenPr: async () => undefined,
      checkoutNewBranch,
      checkoutExistingBranch,
      commitAiAdditions,
      push,
      openPr,
      checkout,
    }));

    expect(checkoutNewBranch).toHaveBeenCalledWith("rsi-pending-candidates", "base");
    expect(checkoutExistingBranch).not.toHaveBeenCalled();
    expect(commitAiAdditions).toHaveBeenCalledWith("New candidates");
    expect(push).toHaveBeenCalledWith("rsi-pending-candidates");
    expect(openPr).toHaveBeenCalledWith(
      "rsi-pending-candidates", expect.any(String), expect.any(String));
    expect(checkout).toHaveBeenCalledWith("base");
  });

  test("adds to the existing open PR's branch instead of opening a new one", async () => {
    const checkoutNewBranch = jest.fn();
    const checkoutExistingBranch = jest.fn();
    const openPr = jest.fn();
    const push = jest.fn();
    await commitAndPushPendingCandidates("More candidates", fakeDeps({
      findOpenPr: async () => ({number: 42}),
      checkoutNewBranch,
      checkoutExistingBranch,
      openPr,
      push,
    }));

    expect(checkoutExistingBranch).toHaveBeenCalledWith("rsi-pending-candidates");
    expect(checkoutNewBranch).not.toHaveBeenCalled();
    expect(openPr).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("rsi-pending-candidates");
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
