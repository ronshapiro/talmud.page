import {postWithRetry} from "../post";
import {
  clearInFlightDecisionsForTesting,
  clearPendingOfflineRsiDecisionsForTesting,
  flushPendingOfflineRsiDecisions,
  getPendingOfflineRsiDecisions,
  initializeOfflineRsiRetries,
  isDecisionInFlight,
  markDecisionInFlight,
  OFFLINE_RSI_DECISIONS_STORAGE_KEY,
  removePendingOfflineRsiDecision,
  resetOfflineRsiRetriesForTesting,
  savePendingOfflineRsiDecision,
  unmarkDecisionInFlight,
} from "../offlineRsiEdits";
import {flushAsync} from "./testing/dom";
import {rsiReviewKeyPreference, rsiReviewPrNumberPreference} from "../settings";
import {snackbars} from "../snackbar";

jest.mock("../post", () => ({
  ...jest.requireActual<Record<string, unknown>>("../post"),
  postWithRetry: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  clearInFlightDecisionsForTesting();
  clearPendingOfflineRsiDecisionsForTesting();
  resetOfflineRsiRetriesForTesting();
  (postWithRetry as jest.Mock).mockReset();
});

describe("offlineRsiEdits storage and queue operations", () => {
  test("saves and retrieves pending offline RSI decisions", () => {
    expect(getPendingOfflineRsiDecisions()).toEqual([]);

    const savedDecision = savePendingOfflineRsiDecision({
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
      key: "secretKey123",
      hebrew: "שלום",
      english: "Hello",
    });

    expect(savedDecision.id).toBeDefined();
    expect(savedDecision.timestamp).toBeGreaterThan(0);
    expect(savedDecision.page).toBe("Berakhot 2a");

    const retrievedDecisions = getPendingOfflineRsiDecisions();
    expect(retrievedDecisions.length).toBe(1);
    expect(retrievedDecisions[0]).toEqual(savedDecision);
  });

  test("handles corrupted localStorage gracefully", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(OFFLINE_RSI_DECISIONS_STORAGE_KEY, "invalid json {");
    expect(getPendingOfflineRsiDecisions()).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  test("removes decision by identifier and clears key when empty", () => {
    const firstDecision = savePendingOfflineRsiDecision({
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
    });
    const secondDecision = savePendingOfflineRsiDecision({
      page: "Berakhot 2a",
      ref: "Berakhot 2a:2",
      decision: "reject",
      reviewerIdentity: "reviewer@example.com",
    });

    expect(getPendingOfflineRsiDecisions().length).toBe(2);

    removePendingOfflineRsiDecision(firstDecision.id);
    const remainingDecisions = getPendingOfflineRsiDecisions();
    expect(remainingDecisions.length).toBe(1);
    expect(remainingDecisions[0].id).toBe(secondDecision.id);

    removePendingOfflineRsiDecision(secondDecision.id);
    expect(getPendingOfflineRsiDecisions()).toEqual([]);
    expect(localStorage.getItem(OFFLINE_RSI_DECISIONS_STORAGE_KEY)).toBeNull();
  });

  test("tracks in-flight decision identifiers", () => {
    expect(isDecisionInFlight("test-identifier")).toBe(false);

    markDecisionInFlight("test-identifier");
    expect(isDecisionInFlight("test-identifier")).toBe(true);

    unmarkDecisionInFlight("test-identifier");
    expect(isDecisionInFlight("test-identifier")).toBe(false);
  });
});

describe("flushPendingOfflineRsiDecisions", () => {
  beforeEach(() => {
    rsiReviewKeyPreference.set("reviewKeySecret");
  });

  test("retries queued decisions sequentially and updates known PR number", async () => {
    const showSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());

    savePendingOfflineRsiDecision({
      id: "first-decision-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
    });
    savePendingOfflineRsiDecision({
      id: "second-decision-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:2",
      decision: "reject",
      reviewerIdentity: "reviewer@example.com",
      reason: "Incorrect translation",
    });

    (postWithRetry as jest.Mock)
      .mockResolvedValueOnce({url: "https://example.com/pull/101", prNumber: 101})
      .mockResolvedValueOnce({url: "https://example.com/pull/101", prNumber: 101});

    await flushPendingOfflineRsiDecisions();

    expect(postWithRetry).toHaveBeenCalledTimes(2);

    expect(postWithRetry).toHaveBeenNthCalledWith(1, "/api/rsi-review-decision", {
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      key: "reviewKeySecret",
      knownPrNumber: undefined,
      reviewerIdentity: "reviewer@example.com",
      hebrew: undefined,
      english: undefined,
      fallbackHebrew: undefined,
      fallbackEnglish: undefined,
      reason: undefined,
    });

    expect(rsiReviewPrNumberPreference.get()).toBe("101");

    expect(postWithRetry).toHaveBeenNthCalledWith(2, "/api/rsi-review-decision", {
      page: "Berakhot 2a",
      ref: "Berakhot 2a:2",
      decision: "reject",
      key: "reviewKeySecret",
      knownPrNumber: 101,
      reviewerIdentity: "reviewer@example.com",
      hebrew: undefined,
      english: undefined,
      fallbackHebrew: undefined,
      fallbackEnglish: undefined,
      reason: "Incorrect translation",
    });

    expect(getPendingOfflineRsiDecisions()).toEqual([]);
    expect(showSpy).toHaveBeenCalledTimes(2);

    showSpy.mockRestore();
  });

  test("skips in-flight decisions to avoid duplicate submission", async () => {
    savePendingOfflineRsiDecision({
      id: "active-in-flight-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
    });
    markDecisionInFlight("active-in-flight-id");

    await flushPendingOfflineRsiDecisions();

    expect(postWithRetry).not.toHaveBeenCalled();
    expect(getPendingOfflineRsiDecisions().length).toBe(1);
  });

  test("halts queue processing on network failure and preserves remaining decisions", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    savePendingOfflineRsiDecision({
      id: "first-decision-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
    });
    savePendingOfflineRsiDecision({
      id: "second-decision-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:2",
      decision: "reject",
      reviewerIdentity: "reviewer@example.com",
    });

    (postWithRetry as jest.Mock).mockRejectedValueOnce(new Error("Network unavailable"));

    await flushPendingOfflineRsiDecisions();

    expect(postWithRetry).toHaveBeenCalledTimes(1);
    expect(getPendingOfflineRsiDecisions().length).toBe(2);
    consoleErrorSpy.mockRestore();
  });

  test("removes non-retryable 403 error decision from queue", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    savePendingOfflineRsiDecision({
      id: "unauthorized-decision-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
    });

    const forbiddenError = Object.assign(new Error("Forbidden"), {status: 403});
    (postWithRetry as jest.Mock).mockRejectedValueOnce(forbiddenError);

    await flushPendingOfflineRsiDecisions();

    expect(getPendingOfflineRsiDecisions()).toEqual([]);
    consoleErrorSpy.mockRestore();
  });
});

describe("initializeOfflineRsiRetries", () => {
  test("triggers queue flush when online event fires on window", async () => {
    rsiReviewKeyPreference.set("reviewKeySecret");
    const onLineSpy = jest.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    savePendingOfflineRsiDecision({
      id: "offline-item-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
    });

    (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});

    initializeOfflineRsiRetries();

    expect(postWithRetry).not.toHaveBeenCalled();

    onLineSpy.mockReturnValue(true);
    await flushAsync(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(postWithRetry).toHaveBeenCalledWith(
      "/api/rsi-review-decision",
      expect.objectContaining({ref: "Berakhot 2a:1"}),
    );
    expect(getPendingOfflineRsiDecisions()).toEqual([]);

    onLineSpy.mockRestore();
  });

  test("flushes immediately on initialization when already online", async () => {
    rsiReviewKeyPreference.set("reviewKeySecret");
    savePendingOfflineRsiDecision({
      id: "offline-item-id",
      page: "Berakhot 2a",
      ref: "Berakhot 2a:1",
      decision: "approve",
      reviewerIdentity: "reviewer@example.com",
    });

    (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});

    await flushAsync(() => {
      initializeOfflineRsiRetries();
    });

    expect(postWithRetry).toHaveBeenCalledWith(
      "/api/rsi-review-decision",
      expect.objectContaining({ref: "Berakhot 2a:1"}),
    );
    expect(getPendingOfflineRsiDecisions()).toEqual([]);
  });
});
