import * as React from "react";
import {RsiReviewControls} from "../RsiReviewControls";
import {postWithRetry} from "../post";
import {rsiReviewKeyPreference} from "../settings";
import {click, flushAsync, mount, query, queryAll, unmountAll} from "./testing/dom";
import {comment, resetFixtureCounter} from "./testing/fixtures";

jest.mock("../post", () => ({postWithRetry: jest.fn()}));

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

  test("approve posts the decision as-is", async () => {
    rsiReviewKeyPreference.set("secret123");
    (postWithRetry as jest.Mock).mockResolvedValue({url: "https://example.com/pull/1"});
    const root = mount(<RsiReviewControls comment={
      comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
    } />);

    await flushAsync(() => click(query(root, "button")));

    expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", {
      page: "Zevachim 2a", ref: "Zevachim 2a:1", decision: "approve", key: "secret123",
    });
  });

  test("edit reveals textareas and submits the overridden text", async () => {
    rsiReviewKeyPreference.set("secret123");
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
      hebrew: "א",
      english: "a",
    });
  });

  test("reject prompts for an optional reason and posts it", async () => {
    rsiReviewKeyPreference.set("secret123");
    (postWithRetry as jest.Mock).mockResolvedValue({});
    const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("mistranslated");
    const root = mount(<RsiReviewControls comment={
      comment({pendingReview: "Zevachim 2a", ref: "Zevachim 2a:1"})
    } />);

    await flushAsync(() => click(queryAll(root, "button")[2])); // Reject

    expect(postWithRetry).toHaveBeenCalledWith("/api/rsi-review-decision", {
      page: "Zevachim 2a",
      ref: "Zevachim 2a:1",
      decision: "reject",
      key: "secret123",
      reason: "mistranslated",
    });
    promptSpy.mockRestore();
  });
});
