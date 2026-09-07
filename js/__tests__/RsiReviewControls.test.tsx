import * as React from "react";
import {RsiReviewControls} from "../RsiReviewControls";
import {postWithRetry} from "../post";
import {snackbars} from "../snackbar";
import {rsiReviewerIdentityPreference, rsiReviewKeyPreference, rsiReviewPrNumberPreference}
  from "../settings";
import {click, flushAsync, mount, query, queryAll, unmountAll} from "./testing/dom";
import {comment, resetFixtureCounter} from "./testing/fixtures";

jest.mock("../post", () => ({postWithRetry: jest.fn()}));

const IDENTITY = "ron@example.com";

beforeEach(() => {
  localStorage.clear();
  resetFixtureCounter();
  (postWithRetry as jest.Mock).mockReset();
});
afterEach(() => unmountAll());

describe("RsiReviewControls", () => {
  test("renders nothing for a comment that isn't pending review", () => {
    const root = mount(<RsiReviewControls comment={comment()} />);

    expect(root.children.length).toBe(0);
  });

  test("renders nothing without a review key, even if pending", () => {
    const root = mount(<RsiReviewControls comment={comment({pendingReview: "Zevachim 2a"})} />);

    expect(root.children.length).toBe(0);
  });

  test("shows approve/edit/reject once a review key is present", () => {
    rsiReviewKeyPreference.set("secret123");
    const root = mount(<RsiReviewControls comment={comment({pendingReview: "Zevachim 2a"})} />);

    expect(queryAll(root, "button").map(b => b.textContent)).toEqual(
      ["Approve", "Edit", "Reject"]);
  });

  describe("reviewer identity", () => {
    test("prompts before the first decision, then remembers it for later ones", async () => {
      rsiReviewKeyPreference.set("secret123");
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      click(query(root, "button")); // Approve
      const identityInput = query(root, "input[type=text]") as HTMLInputElement;
      identityInput.value = IDENTITY;
      await flushAsync(() => click(query(root, ".modal-content .mdl-button--accent")));

      expect(rsiReviewerIdentityPreference.get()).toEqual(IDENTITY);
      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", expect.objectContaining({
        reviewerIdentity: IDENTITY,
      }));
    });

    test("does not prompt again once an identity is already stored", async () => {
      rsiReviewKeyPreference.set("secret123");
      rsiReviewerIdentityPreference.set(IDENTITY);
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button"))); // Approve

      expect(query(root, ".rsi-review-controls")).toBeTruthy();
      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", expect.objectContaining({
        reviewerIdentity: IDENTITY,
      }));
    });
  });

  describe("once an identity is already stored", () => {
    beforeEach(() => {
      rsiReviewKeyPreference.set("secret123");
      rsiReviewerIdentityPreference.set(IDENTITY);
    });

    test("approve posts the decision as-is", async () => {
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", {
        page: "Zevachim 2a",
        ref: "Zevachim 2a:1",
        decision: "approve",
        key: "secret123",
        knownPrNumber: undefined,
        reviewerIdentity: IDENTITY,
      });
    });

    test("includes the last-known PR number, and remembers whatever comes back", async () => {
      rsiReviewPrNumberPreference.set("7");
      (postWithRetry as jest.Mock).mockResolvedValue({
        url: "https://example.com/pull/9", prNumber: 9,
      });
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision",
        expect.objectContaining({knownPrNumber: 7}));
      expect(rsiReviewPrNumberPreference.get()).toEqual("9");
    });

    test("edit reveals textareas and submits the overridden text", async () => {
      (postWithRetry as jest.Mock).mockResolvedValue({});
      const root = mount(<RsiReviewControls comment={comment({
        pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1", he: "א", en: "a",
      })} />);

      click(queryAll(root, "button")[1]); // Edit
      expect(queryAll(root, "textarea").length).toBe(2);

      await flushAsync(() => click(query(root, "button"))); // Submit edit

      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", {
        page: "Zevachim 2a",
        ref: "Zevachim 2a:1",
        decision: "approve",
        key: "secret123",
        knownPrNumber: undefined,
        reviewerIdentity: IDENTITY,
        hebrew: "א",
        english: "a",
      });
    });

    test("reject shows a modal for the reason instead of a native prompt", async () => {
      (postWithRetry as jest.Mock).mockResolvedValue({});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      click(queryAll(root, "button")[2]); // Reject
      const reasonInput = query(root, ".modal textarea") as HTMLTextAreaElement;
      reasonInput.value = "mistranslated";
      await flushAsync(() => click(query(root, ".modal-content .mdl-button--accent")));

      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", expect.objectContaining({
        decision: "reject", reason: "mistranslated",
      }));
    });

    test("canceling the reject modal submits nothing", () => {
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      click(queryAll(root, "button")[2]); // Reject
      click(query(root, ".modal-cancel"));

      expect(postWithRetry).not.toHaveBeenCalled();
      expect(queryAll(root, ".modal").length).toBe(0);
    });

    test("shows a submitting snackbar immediately, then updates it once the PR opens", async () => {
      const showSpy = jest.spyOn(snackbars.reportedIssueSent, "show");
      const updateSpy = jest.spyOn(snackbars.reportedIssueSent, "update");
      let resolvePost: (value: unknown) => void = () => {};
      (postWithRetry as jest.Mock).mockReturnValue(
        new Promise(resolve => { resolvePost = resolve; }));
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      click(query(root, "button")); // Approve — fires the request but doesn't resolve yet

      expect(showSpy).toHaveBeenCalledWith(
        expect.stringContaining("Submitting"), expect.anything());
      expect(updateSpy).not.toHaveBeenCalled();

      await flushAsync(() => resolvePost({url: "https://example.com/pull/1"}));

      expect(updateSpy).toHaveBeenCalledWith(
        expect.stringContaining("Approved"), expect.anything());

      showSpy.mockRestore();
      updateSpy.mockRestore();
    });
  });
});
