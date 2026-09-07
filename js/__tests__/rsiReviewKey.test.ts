import {getRsiReviewKey, initializeRsiReviewKey} from "../rsiReviewKey";
import {rsiReviewKeyPreference} from "../settings";

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, "", "/Zevachim/2a");
});

describe("initializeRsiReviewKey", () => {
  test("does nothing when no rsiReviewKey param is present", () => {
    initializeRsiReviewKey();

    expect(rsiReviewKeyPreference.get()).toBeUndefined();
  });

  test("persists the key and strips it from the URL", () => {
    window.history.pushState({}, "", "/Zevachim/2a?rsiReviewKey=secret123");

    initializeRsiReviewKey();

    expect(rsiReviewKeyPreference.get()).toBe("secret123");
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/Zevachim/2a");
  });

  test("preserves other query params after stripping the key", () => {
    window.history.pushState({}, "", "/Zevachim/2a?foo=bar&rsiReviewKey=secret123");

    initializeRsiReviewKey();

    expect(window.location.search).toBe("?foo=bar");
  });
});

describe("getRsiReviewKey", () => {
  test("reflects what was persisted", () => {
    expect(getRsiReviewKey()).toBeUndefined();

    rsiReviewKeyPreference.set("secret123");

    expect(getRsiReviewKey()).toBe("secret123");
  });
});
