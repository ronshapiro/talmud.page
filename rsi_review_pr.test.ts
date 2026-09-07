import {openReviewDecisionPr} from "./rsi_review_pr";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

interface FakePr {
  number: number;
  head: {ref: string};
  body: string;
  state: "open" | "closed";
}

/**
 * A minimal in-memory stand-in for the slice of the GitHub REST API rsi_review_pr.ts calls —
 * tracks per-branch file content/shas and PRs, so multi-call tests (batching into one PR) can
 * assert on state that persists across calls the way the real API would.
 */
class FakeGitHub {
  calls: Array<{url: string; init?: RequestInit}> = [];
  private branches: Record<string, Record<string, string>> = {base: {}};
  private shas: Record<string, Record<string, string>> = {base: {}};
  private prs: FakePr[] = [];
  private nextPr = 1;

  constructor(basePages: Record<string, Record<string, unknown>> = {}) {
    for (const [page, edits] of Object.entries(basePages)) {
      const path = `precomputed/ai_additions/${page}.json`;
      this.branches.base[path] = Buffer.from(JSON.stringify(edits)).toString("base64");
      this.shas.base[path] = "base-file-sha";
    }
  }

  /** Lets a test seed a PR as if a previous call had created it — open by default. */
  seedPr(headRef: string, body = "", state: "open" | "closed" = "open"): number {
    const number = this.nextPr++;
    this.prs.push({number, head: {ref: headRef}, body, state});
    this.branches[headRef] = {};
    this.shas[headRef] = {};
    return number;
  }

  closePr(number: number): void {
    this.prs.find(pr => pr.number === number)!.state = "closed";
  }

  contentOf(branch: string, page: string): Record<string, unknown> {
    const path = `precomputed/ai_additions/${page}.json`;
    const encoded = this.branches[branch]?.[path] ?? this.branches.base[path];
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  }

  allPrs(): FakePr[] {
    return this.prs;
  }

  fetchImpl: typeof fetch = (async (url: string, init?: RequestInit) => {
    this.calls.push({url, init});
    const method = init?.method ?? "GET";

    const singlePrMatch = url.match(/\/pulls\/(\d+)$/);
    if (singlePrMatch && method === "GET") {
      const pr = this.prs.find(p => p.number === Number(singlePrMatch[1]));
      if (!pr) return {ok: false, status: 404, text: async () => "not found"} as Response;
      return jsonResponse(pr);
    }
    if (singlePrMatch && method === "PATCH") {
      const pr = this.prs.find(p => p.number === Number(singlePrMatch[1]))!;
      pr.body = (JSON.parse(init!.body as string) as {body: string}).body;
      return jsonResponse({});
    }
    if (url.includes("/contents/") && method === "GET") {
      const [, query] = url.split("?ref=");
      const branch = query ? decodeURIComponent(query) : "base";
      const path = decodeURIComponent(url.split("/contents/")[1].split("?")[0]);
      const content = this.branches[branch]?.[path] ?? this.branches.base[path];
      const sha = this.shas[branch]?.[path] ?? this.shas.base[path];
      return jsonResponse({content, sha});
    }
    if (url.includes("/git/ref/heads/base")) {
      return jsonResponse({object: {sha: "base-commit-sha"}});
    }
    if (url.includes("/git/refs") && method === "POST") {
      const body = JSON.parse(init!.body as string) as {ref: string};
      const branch = body.ref.replace("refs/heads/", "");
      this.branches[branch] = {};
      this.shas[branch] = {};
      return jsonResponse({});
    }
    if (url.includes("/contents/") && method === "PUT") {
      const path = decodeURIComponent(url.split("/contents/")[1]);
      const body = JSON.parse(init!.body as string) as {branch: string; content: string};
      this.branches[body.branch] ??= {};
      this.shas[body.branch] ??= {};
      this.branches[body.branch][path] = body.content;
      this.shas[body.branch][path] = `sha-${Object.keys(this.shas[body.branch]).length}`;
      return jsonResponse({});
    }
    if (url.endsWith("/pulls") && method === "POST") {
      const body = JSON.parse(init!.body as string) as {head: string; body: string};
      const number = this.nextPr++;
      this.prs.push({number, head: {ref: body.head}, body: body.body, state: "open"});
      return jsonResponse({
        html_url: `https://github.com/ronshapiro/talmud.page/pull/${number}`,
        number,
      });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  }) as unknown as typeof fetch;
}

describe("openReviewDecisionPr", () => {
  test("approve clears pending status and keeps the AI-proposed text", async () => {
    const github = new FakeGitHub({
      "Zevachim 2a": {"Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"}},
    });
    const result = await openReviewDecisionPr(
      {page: "Zevachim 2a", ref: "Zevachim 2a:1", decision: "approve"}, "token",
      github.fetchImpl);

    expect(result.prNumber).toEqual(1);
    const branch = github.allPrs()[0].head.ref;
    expect(github.contentOf(branch, "Zevachim 2a")["Zevachim 2a:1"])
      .toEqual({hebrew: "א", english: "a"});
  });

  test("approve with edited text overwrites hebrew/english", async () => {
    const github = new FakeGitHub({
      "Zevachim 2a": {"Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"}},
    });
    const result = await openReviewDecisionPr({
      page: "Zevachim 2a",
      ref: "Zevachim 2a:1",
      decision: "approve",
      hebrew: "ב",
      english: "b",
    }, "token", github.fetchImpl);

    const branch = github.allPrs()[0].head.ref;
    expect(github.contentOf(branch, "Zevachim 2a")["Zevachim 2a:1"])
      .toEqual({hebrew: "ב", english: "b"});
    expect(result.prNumber).toEqual(1);
  });

  test("reject deletes the ref's entry and records the reason in the PR body", async () => {
    const github = new FakeGitHub({
      "Zevachim 2a": {
        "Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"},
        "Zevachim 2a:2": {hebrew: "ג", english: "c"},
      },
    });
    await openReviewDecisionPr({
      page: "Zevachim 2a",
      ref: "Zevachim 2a:1",
      decision: "reject",
      reason: "mistranslated",
    }, "token", github.fetchImpl);

    const branch = github.allPrs()[0].head.ref;
    expect(github.contentOf(branch, "Zevachim 2a")).toEqual({
      "Zevachim 2a:2": {hebrew: "ג", english: "c"},
    });
    expect(github.allPrs()[0].body).toContain("mistranslated");
  });

  test("records the reviewer's self-reported identity in the PR body", async () => {
    const github = new FakeGitHub({
      "Zevachim 2a": {"Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"}},
    });
    await openReviewDecisionPr({
      page: "Zevachim 2a",
      ref: "Zevachim 2a:1",
      decision: "approve",
      reviewerIdentity: "ron@example.com",
    }, "token", github.fetchImpl);

    expect(github.allPrs()[0].body).toContain("ron@example.com");
  });

  test("throws when the ref has no ai_edits.ts entry", async () => {
    const github = new FakeGitHub({"Zevachim 2a": {}});
    await expect(openReviewDecisionPr(
      {page: "Zevachim 2a", ref: "Zevachim 2a:1", decision: "approve"}, "token",
      github.fetchImpl,
    )).rejects.toThrow("No ai_edits.ts entry");
  });

  describe("batching via knownPrNumber", () => {
    test("passing the PR number returned by an earlier call reuses that PR", async () => {
      const github = new FakeGitHub({
        "Zevachim 2a": {
          "Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"},
          "Zevachim 2a:2": {hebrew: "ד", english: "d", status: "pending"},
        },
      });

      const first = await openReviewDecisionPr(
        {page: "Zevachim 2a", ref: "Zevachim 2a:1", decision: "approve"}, "token",
        github.fetchImpl);
      const second = await openReviewDecisionPr(
        {
          page: "Zevachim 2a",
          ref: "Zevachim 2a:2",
          decision: "approve",
          knownPrNumber: first.prNumber,
        }, "token", github.fetchImpl);

      expect(second.prNumber).toEqual(first.prNumber);
      expect(github.allPrs().length).toBe(1);
      expect(github.calls.some(c => c.url.includes("/git/refs") && c.init?.method === "POST"))
        .toBe(true); // only the first call creates a branch

      const branch = github.allPrs()[0].head.ref;
      const content = github.contentOf(branch, "Zevachim 2a");
      expect(content["Zevachim 2a:1"]).toEqual({hebrew: "א", english: "a"});
      expect(content["Zevachim 2a:2"]).toEqual({hebrew: "ד", english: "d"});
    });

    test("without a knownPrNumber, a new PR opens even while another is open", async () => {
      const github = new FakeGitHub({
        "Zevachim 2a": {"Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"}},
      });
      github.seedPr("rsi-review/someone-elses-batch", "Someone else's batch");

      const result = await openReviewDecisionPr(
        {page: "Zevachim 2a", ref: "Zevachim 2a:1", decision: "approve"}, "token",
        github.fetchImpl);

      expect(github.allPrs().length).toBe(2);
      expect(result.prNumber).not.toEqual(1);
    });

    test("a knownPrNumber that's no longer open starts a fresh PR", async () => {
      const github = new FakeGitHub({
        "Zevachim 2a": {"Zevachim 2a:1": {hebrew: "א", english: "a", status: "pending"}},
      });
      const staleNumber = github.seedPr("rsi-review/1700000000000", "Merged already");
      github.closePr(staleNumber);

      const result = await openReviewDecisionPr(
        {
          page: "Zevachim 2a",
          ref: "Zevachim 2a:1",
          decision: "approve",
          knownPrNumber: staleNumber,
        }, "token", github.fetchImpl);

      expect(result.prNumber).not.toEqual(staleNumber);
      expect(github.allPrs().find(pr => pr.number === result.prNumber)!.state).toEqual("open");
    });
  });
});
