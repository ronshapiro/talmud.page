import {Suggestion, TriageDeps, triageOpenSuggestions} from "./triage_suggestions";

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {number: 1, title: "Add X", body: "Please add X", ...overrides};
}

function fakeDeps(overrides: Partial<TriageDeps> = {}): TriageDeps {
  return {
    listOpenSuggestions: async () => [],
    commentOnIssue: async () => {},
    assessFeasibility: async () => "assessment",
    isAlreadyTriaged: () => false,
    markTriaged: () => {},
    ...overrides,
  };
}

test("does nothing when there are no open suggestions", async () => {
  const commentOnIssue = jest.fn();
  await triageOpenSuggestions(fakeDeps({
    listOpenSuggestions: async () => [],
    commentOnIssue,
  }));
  expect(commentOnIssue).not.toHaveBeenCalled();
});

test("assesses and comments on a new suggestion, then marks it triaged", async () => {
  const commentOnIssue = jest.fn(async (_issueNumber: number, _comment: string) => {});
  const markTriaged = jest.fn();
  await triageOpenSuggestions(fakeDeps({
    listOpenSuggestions: async () => [suggestion({number: 42})],
    assessFeasibility: async s => `feasible: ${s.title}`,
    commentOnIssue,
    markTriaged,
  }));
  expect(commentOnIssue).toHaveBeenCalledWith(42, "feasible: Add X");
  expect(markTriaged).toHaveBeenCalledWith(42);
});

test("skips a suggestion that was already triaged", async () => {
  const commentOnIssue = jest.fn();
  const assessFeasibility = jest.fn();
  await triageOpenSuggestions(fakeDeps({
    listOpenSuggestions: async () => [suggestion({number: 7})],
    isAlreadyTriaged: (n) => n === 7,
    commentOnIssue,
    assessFeasibility,
  }));
  expect(assessFeasibility).not.toHaveBeenCalled();
  expect(commentOnIssue).not.toHaveBeenCalled();
});

test("processes multiple suggestions independently", async () => {
  const commented: number[] = [];
  await triageOpenSuggestions(fakeDeps({
    listOpenSuggestions: async () => [
      suggestion({number: 1}),
      suggestion({number: 2}),
      suggestion({number: 3}),
    ],
    isAlreadyTriaged: (n) => n === 2,
    commentOnIssue: async (n) => {
      commented.push(n);
    },
  }));
  expect(commented).toEqual([1, 3]);
});
