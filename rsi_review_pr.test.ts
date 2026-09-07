import {openReviewDecisionPr} from "./rsi_review_pr";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function fakeEdits(edits: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(edits)).toString("base64");
}

function fakeFetch(edits: Record<string, unknown>) {
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({url, init});
    if (url.includes("/contents/") && (!init || init.method === undefined)) {
      return jsonResponse({content: fakeEdits(edits), sha: "file-sha"});
    }
    if (url.includes("/git/ref/heads/base")) {
      return jsonResponse({object: {sha: "base-sha"}});
    }
    if (url.includes("/git/refs")) {
      return jsonResponse({});
    }
    if (url.includes("/contents/") && init?.method === "PUT") {
      return jsonResponse({});
    }
    if (url.includes("/pulls")) {
      return jsonResponse({html_url: "https://github.com/ronshapiro/talmud.page/pull/999"});
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  return {fetchImpl: fetchImpl as unknown as typeof fetch, calls};
}

describe("openReviewDecisionPr", () => {
  test("approve clears pending status and keeps the AI-proposed text", async () => {
    const {fetchImpl, calls} = fakeFetch({
      "Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"},
    });
    const result = await openReviewDecisionPr(
      {page: "Zevachim 2a", ref: "Zevachim 2a:1", decision: "approve"}, "token", fetchImpl);
    expect(result.url).toEqual("https://github.com/ronshapiro/talmud.page/pull/999");

    const put = calls.find(c => c.init?.method === "PUT")!;
    const body = JSON.parse(put.init!.body as string);
    const written = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
    expect(written["Zevachim 2a:1"]).toEqual({hebrew: "א", english: "a"});
  });

  test("approve with edited text overwrites hebrew/english", async () => {
    const {fetchImpl, calls} = fakeFetch({
      "Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"},
    });
    await openReviewDecisionPr({
      page: "Zevachim 2a",
      ref: "Zevachim 2a:1",
      decision: "approve",
      hebrew: "ב",
      english: "b",
    }, "token", fetchImpl);

    const put = calls.find(c => c.init?.method === "PUT")!;
    const body = JSON.parse(put.init!.body as string);
    const written = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
    expect(written["Zevachim 2a:1"]).toEqual({hebrew: "ב", english: "b"});
  });

  test("reject deletes the ref's entry and records the reason", async () => {
    const {fetchImpl, calls} = fakeFetch({
      "Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"},
      "Zevachim 2a:2": {hebrew: "ג", english: "c"},
    });
    await openReviewDecisionPr({
      page: "Zevachim 2a",
      ref: "Zevachim 2a:1",
      decision: "reject",
      reason: "mistranslated",
    }, "token", fetchImpl);

    const put = calls.find(c => c.init?.method === "PUT")!;
    const body = JSON.parse(put.init!.body as string);
    const written = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
    expect(written).toEqual({"Zevachim 2a:2": {hebrew: "ג", english: "c"}});
    expect(body.message).toContain("mistranslated");

    const pullsCall = calls.find(c => c.url.includes("/pulls"))!;
    const pullsBody = JSON.parse(pullsCall.init!.body as string);
    expect(pullsBody.body).toContain("mistranslated");
  });

  test("throws when the ref has no ai_edits.ts entry", async () => {
    const {fetchImpl} = fakeFetch({});
    await expect(openReviewDecisionPr(
      {page: "Zevachim 2a", ref: "Zevachim 2a:1", decision: "approve"}, "token", fetchImpl,
    )).rejects.toThrow("No ai_edits.ts entry");
  });
});
