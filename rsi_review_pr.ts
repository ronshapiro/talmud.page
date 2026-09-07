import {Edit} from "./precomputed/ai_edits";

// Opens a PR against a single ref's ai_edits.ts entry from a plain HTTPS call to the GitHub REST
// API — no git binary, no local checkout. This is the same approach express.ts's
// /api/suggest-rsi-task already uses to file an issue: GitHub's Contents/Git-Refs/Pulls endpoints
// let a stateless server (this runs on App Engine) create a commit and a PR over HTTP.
const REPO = "ronshapiro/talmud.page";
const BASE_BRANCH = "base";

export interface ReviewDecisionRequest {
  page: string;
  ref: string;
  decision: "approve" | "reject";
  // Edited replacement text — only meaningful for "approve" (an edit is an approve with
  // overridden text). Undefined means "ship the AI-proposed text as-is."
  hebrew?: string;
  english?: string;
  // Only meaningful for "reject" — recorded in the PR body as the retry signal for a future run.
  reason?: string;
}

export interface ReviewDecisionResult {
  url: string;
}

type FetchFn = typeof fetch;

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function githubRequest<T>(
  fetchImpl: FetchFn, token: string, path: string, init: RequestInit = {},
): Promise<T> {
  const response = await fetchImpl(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Approve (optionally with edited text) or reject a single pending ai_edits.ts entry, and open a
 * PR carrying the result. Approve clears `status: "pending"` (and overwrites hebrew/english if
 * given); reject deletes the ref's entry entirely so the next scheduled translation run's
 * staleness check treats it as never-generated and retries from scratch.
 */
export async function openReviewDecisionPr(
  request: ReviewDecisionRequest,
  token: string,
  fetchImpl: FetchFn = fetch,
): Promise<ReviewDecisionResult> {
  const {page, ref, decision, hebrew, english, reason} = request;
  const path = `precomputed/ai_additions/${page}.json`;
  const encodedPath = encodePath(path);

  const file = await githubRequest<{content: string; sha: string}>(
    fetchImpl, token, `/repos/${REPO}/contents/${encodedPath}?ref=${BASE_BRANCH}`);
  const edits = JSON.parse(
    Buffer.from(file.content, "base64").toString("utf8")) as Record<string, Edit>;
  if (!edits[ref]) {
    throw new Error(`No ai_edits.ts entry for ${page} ${ref}`);
  }

  const verb = decision === "approve" ? "Approve" : "Reject";
  let message = `${verb} RSI translation for ${ref}`;
  if (decision === "approve") {
    const existing = edits[ref];
    edits[ref] = {
      hebrew: hebrew !== undefined ? hebrew : existing.hebrew,
      english: english !== undefined ? english : existing.english,
    };
  } else {
    delete edits[ref];
    if (reason) {
      message += `: ${reason}`;
    }
  }

  const baseRef = await githubRequest<{object: {sha: string}}>(
    fetchImpl, token, `/repos/${REPO}/git/ref/heads/${BASE_BRANCH}`);
  const branch = `rsi-review/${page.replace(/[^\dA-Za-z]+/g, "-")}-${Date.now()}`;
  await githubRequest(fetchImpl, token, `/repos/${REPO}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ref: `refs/heads/${branch}`, sha: baseRef.object.sha}),
  });

  await githubRequest(fetchImpl, token, `/repos/${REPO}/contents/${encodedPath}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(edits, undefined, 2)).toString("base64"),
      sha: file.sha,
      branch,
    }),
  });

  // No reviewer username in the PR body — this codebase has no login/identity system to draw one
  // from (see RSI Phase 3 plan); the review key only proves "a key-holder," not who.
  const pr = await githubRequest<{html_url: string}>( // eslint-disable-line camelcase
    fetchImpl, token, `/repos/${REPO}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: message,
        head: branch,
        base: BASE_BRANCH,
        body: `${message} — via the review overlay at ${new Date().toISOString()}.`,
      }),
    });

  return {url: pr.html_url};
}
