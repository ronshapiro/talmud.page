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

jest.mock("../post", () => ({
  ...jest.requireActual<Record<string, unknown>>("../post"),
  postWithRetry: jest.fn(),
}));

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
      }), expect.anything());
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
      }), expect.anything());
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
      }, expect.anything());
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
        expect.objectContaining({knownPrNumber: 7}),
        expect.anything());
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
        fallbackHebrew: "א",
        fallbackEnglish: "a",
      }, expect.anything());
    });

    test("approve strips highlights from fallbackHebrew and fallbackEnglish", async () => {
      (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
      const root = mount(<RsiReviewControls comment={
        comment({
          pendingReview: "Zevachim 2a",
          ref: "Zevachim 2a:1",
          he: 'שלום <span-highlight class="highlighted highlighted-yellow">עולם</span-highlight>',
          en: 'hello <span-highlight class="highlighted highlighted-yellow">world</span-highlight>',
          unhighlighted: {
            he: "שלום עולם",
            en: "hello world",
          },
        })
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", {
        page: "Zevachim 2a",
        ref: "Zevachim 2a:1",
        decision: "approve",
        key: "secret123",
        knownPrNumber: undefined,
        reviewerIdentity: IDENTITY,
        fallbackHebrew: "שלום עולם",
        fallbackEnglish: "hello world",
      }, expect.anything());
    });

    test("edit reveals unhighlighted text and submits it", async () => {
      (postWithRetry as jest.Mock).mockResolvedValue({});
      const root = mount(<RsiReviewControls comment={comment({
        pendingReview: "Zevachim 2a",
        ref: "Zevachim 2a:1",
        he: 'שלום <span-highlight class="highlighted highlighted-yellow">עולם</span-highlight>',
        en: 'hello <span-highlight class="highlighted highlighted-yellow">world</span-highlight>',
        unhighlighted: {
          he: "שלום עולם",
          en: "hello world",
        },
      })} />);

      click(queryAll(root, "button")[1]); // Edit
      const textareas = queryAll(root, "textarea") as HTMLTextAreaElement[];
      expect(textareas.length).toBe(2);
      expect(textareas[0].value).toBe("שלום עולם");
      expect(textareas[1].value).toBe("hello world");

      await flushAsync(() => click(query(root, "button"))); // Submit edit

      expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", {
        page: "Zevachim 2a",
        ref: "Zevachim 2a:1",
        decision: "approve",
        key: "secret123",
        knownPrNumber: undefined,
        reviewerIdentity: IDENTITY,
        hebrew: "שלום עולם",
        english: "hello world",
        fallbackHebrew: "שלום עולם",
        fallbackEnglish: "hello world",
      }, expect.anything());
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
      }), expect.anything());
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

    test("appends error to original snackbar on failure and updates in place without using errors snackbar", async () => {
      jest.useFakeTimers();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const showSpy = jest.spyOn(snackbars.reportedIssueSent, "show");
      const updateSpy = jest.spyOn(snackbars.reportedIssueSent, "update");
      const errorsShowSpy = jest.spyOn(snackbars.errors, "show");
      const hideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide");

      let capturedOnError: (
        (errorMessage: string | undefined, errorResponse: unknown) => void
      ) | undefined;
      (postWithRetry as jest.Mock).mockImplementation((_endpoint, _data, options) => {
        capturedOnError = options?.onError;
        return new Promise(() => {});
      });

      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(showSpy).toHaveBeenCalledWith(
        "Submitting approve for Zevachim 2a:1…",
        expect.anything(),
      );
      const initialButtons = showSpy.mock.calls[0][1] as Button[];
      expect(initialButtons.length).toBe(1);
      expect(initialButtons[0].text).toBe("Dismiss");

      expect(capturedOnError).toBeDefined();
      capturedOnError!("Forbidden", {status: 403});

      expect(updateSpy).toHaveBeenCalledWith(
        "Submitting approve for Zevachim 2a:1…<br>Forbidden",
        expect.anything(),
      );
      expect(errorsShowSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      showSpy.mockRestore();
      updateSpy.mockRestore();
      errorsShowSpy.mockRestore();
      hideSpy.mockRestore();
      jest.useRealTimers();
    });

    test("dismissing the original snackbar hides it and prevents subsequent retry errors from reshowing snackbar", async () => {
      const showSpy = jest.spyOn(snackbars.reportedIssueSent, "show");
      const updateSpy = jest.spyOn(snackbars.reportedIssueSent, "update");
      const hideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide");

      let capturedOnError: (
        (errorMessage: string | undefined, errorResponse: unknown) => void
      ) | undefined;
      (postWithRetry as jest.Mock).mockImplementation((_endpoint, _data, options) => {
        capturedOnError = options?.onError;
        return new Promise(() => {});
      });

      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      const buttons = showSpy.mock.calls[0][1] as Button[];
      buttons[0].onClick();

      expect(hideSpy).toHaveBeenCalledTimes(1);

      expect(capturedOnError).toBeDefined();
      capturedOnError!("Forbidden", {status: 403});

      expect(updateSpy).not.toHaveBeenCalled();

      showSpy.mockRestore();
      updateSpy.mockRestore();
      hideSpy.mockRestore();
    });

    test("submission failure on rejection updates original snackbar and auto-dismisses after 10s", async () => {
      jest.useFakeTimers();
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const updateSpy = jest.spyOn(snackbars.reportedIssueSent, "update");
      const errorsShowSpy = jest.spyOn(snackbars.errors, "show");
      const hideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide");
      (postWithRetry as jest.Mock).mockRejectedValue(new Error("Network failure"));
      const root = mount(<RsiReviewControls comment={
        comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
      } />);

      await flushAsync(() => click(query(root, "button")));

      expect(updateSpy).toHaveBeenCalledWith(
        expect.stringContaining("Submitting approve for Zevachim 2a:1…<br>Network failure"),
        expect.anything(),
      );
      expect(errorsShowSpy).not.toHaveBeenCalled();

      expect(hideSpy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(AUTO_DISMISS_DELAY_MILLISECONDS);
      expect(hideSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
      updateSpy.mockRestore();
      errorsShowSpy.mockRestore();
      hideSpy.mockRestore();
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
