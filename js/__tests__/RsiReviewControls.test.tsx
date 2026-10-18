import * as React from "react";
import {
  AUTO_DISMISS_DELAY_MILLISECONDS,
  resetSnackbarDismissTimerForTesting,
  RsiReviewControls,
} from "../RsiReviewControls";
import {postWithRetry} from "../post";
import {Button, snackbars} from "../snackbar";
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
afterEach(() => {
  unmountAll();
  resetSnackbarDismissTimerForTesting();
});

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
        fallbackHebrew: "hebrew of Zevachim 2a:1",
        fallbackEnglish: "english of Zevachim 2a:1",
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

    test("edit opens a modal with textareas and submits the overridden text", async () => {
      (postWithRetry as jest.Mock).mockResolvedValue({});
      const root = mount(<RsiReviewControls comment={comment({
        pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1", he: "א", en: "a",
      })} />);

      click(queryAll(root, "button")[1]); // Edit
      const textAreas = queryAll(root, "textarea") as HTMLTextAreaElement[];
      expect(textAreas.length).toBe(2);
      expect(textAreas[0].value).toBe("א");
      expect(textAreas[1].value).toBe("a");
      textAreas[0].value = "ב";
      textAreas[1].value = "b";

      await flushAsync(
        () => click(query(root, ".modal-content .mdl-button--accent"))); // Submit edit

      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", {
        page: "Zevachim 2a",
        ref: "Zevachim 2a:1",
        decision: "approve",
        key: "secret123",
        knownPrNumber: undefined,
        reviewerIdentity: IDENTITY,
        hebrew: "ב",
        english: "b",
        fallbackHebrew: "א",
        fallbackEnglish: "a",
      });
    });

    test("canceling the edit modal closes the modal and submits nothing", () => {
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      click(queryAll(root, "button")[1]); // Edit
      expect(queryAll(root, "textarea").length).toBe(2);
      click(query(root, ".modal-cancel"));
      expect(queryAll(root, "textarea").length).toBe(0);
      expect(postWithRetry).not.toHaveBeenCalled();
    });

    test("reject shows a modal for the reason", async () => {
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

    test("updated snackbar includes a dismiss button that hides the snackbar when clicked", async () => {
      const updateSpy = jest.spyOn(snackbars.reportedIssueSent, "update");
      const hideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide");
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(updateSpy).toHaveBeenCalled();
      const buttons = updateSpy.mock.calls[0][1] as Button[];
      expect(buttons.length).toBe(1);
      expect(buttons[0].text).toBe("Dismiss");

      buttons[0].onClick();
      expect(hideSpy).toHaveBeenCalledTimes(1);

      updateSpy.mockRestore();
      hideSpy.mockRestore();
    });

    test("updated snackbar automatically dismisses after 10 seconds", async () => {
      jest.useFakeTimers();
      const hideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide");
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(hideSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(AUTO_DISMISS_DELAY_MILLISECONDS - 1);
      expect(hideSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(hideSpy).toHaveBeenCalledTimes(1);

      hideSpy.mockRestore();
      jest.useRealTimers();
    });

    test("clicking dismiss button cancels automatic 10 second dismissal", async () => {
      jest.useFakeTimers();
      const updateSpy = jest.spyOn(snackbars.reportedIssueSent, "update");
      const hideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide");
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      const buttons = updateSpy.mock.calls[0][1] as Button[];
      buttons[0].onClick();
      expect(hideSpy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(AUTO_DISMISS_DELAY_MILLISECONDS);
      expect(hideSpy).toHaveBeenCalledTimes(1);

      updateSpy.mockRestore();
      hideSpy.mockRestore();
      jest.useRealTimers();
    });

    test("subsequent decision submission cancels earlier dismissal timer", async () => {
      jest.useFakeTimers();
      const hideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide");
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      jest.advanceTimersByTime(5000);
      expect(hideSpy).not.toHaveBeenCalled();

      await flushAsync(() => click(query(root, "button")));

      jest.advanceTimersByTime(5000);
      expect(hideSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);
      expect(hideSpy).toHaveBeenCalledTimes(1);

      hideSpy.mockRestore();
      jest.useRealTimers();
    });

    test("submission failure shows error snackbar with dismiss button and auto-dismisses after 10s", async () => {
      jest.useFakeTimers();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const errorShowSpy = jest.spyOn(snackbars.errors, "show");
      const errorHideSpy = jest.spyOn(snackbars.errors, "hide");
      (postWithRetry as jest.Mock).mockRejectedValue(new Error("Network failure"));
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(errorShowSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to submit review decision"),
        expect.anything(),
      );
      const buttons = errorShowSpy.mock.calls[0][1] as Button[];
      expect(buttons.length).toBe(1);
      expect(buttons[0].text).toBe("Dismiss");

      expect(errorHideSpy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(AUTO_DISMISS_DELAY_MILLISECONDS);
      expect(errorHideSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
      errorShowSpy.mockRestore();
      errorHideSpy.mockRestore();
      jest.useRealTimers();
    });

    test("uses Hebrew dismiss button when site language is Hebrew", async () => {
      localStorage.languageOption = "hebrew";
      const updateSpy = jest.spyOn(snackbars.reportedIssueSent, "update");
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      const buttons = updateSpy.mock.calls[0][1] as Button[];
      expect(buttons[0].text).toBe("סגור");

      updateSpy.mockRestore();
    });
  });
});
