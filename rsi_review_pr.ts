import {Edit} from "./precomputed/ai_edits";

// Opens (or adds to) a PR against ai_edits.ts entries from plain HTTPS calls to the GitHub REST
// API — no git binary, no local checkout. This is the same approach express.ts's
// /api/suggest-rsi-task already uses to file an issue: GitHub's Contents/Git-Refs/Pulls endpoints
// let a stateless server (this runs on App Engine) create commits and PRs over HTTP.
const REPO = "ronshapiro/talmud.page";
const BASE_BRANCH = "base";
// Every branch this module creates starts with this — how findOpenReviewPr recognizes "a PR this
// module opened" among the repo's other open PRs, without needing a label (which would need its
// own auto-create-if-missing step) or any server-side state (App Engine gives none to rely on).
const BRANCH_PREFIX = "rsi-review/";

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

interface OpenReviewPr {
  number: number;
  headRef: string;
  body: string;
}

/**
 * Finds this module's own currently-open batch PR, if any — the first open PR against `base`
 * whose head branch starts with BRANCH_PREFIX. While it's open, every decision lands as another
 * commit on that same branch instead of opening a new PR each time; once it's merged (no longer
 * open), the next decision starts a fresh one.
 */
async function findOpenReviewPr(
  fetchImpl: FetchFn, token: string,
): Promise<OpenReviewPr | undefined> {
  type PrListEntry = {number: number; head: {ref: string}; body: string | null};
  const prs = await githubRequest<PrListEntry[]>(
    fetchImpl, token, `/repos/${REPO}/pulls?state=open&base=${BASE_BRANCH}`);
  const match = prs.find(pr => pr.head.ref.startsWith(BRANCH_PREFIX));
  if (!match) return undefined;
  return {number: match.number, headRef: match.head.ref, body: match.body ?? ""};
}

/**
 * Approve (optionally with edited text) or reject a single pending ai_edits.ts entry. Approve
 * clears `status: "pending"` (and overwrites hebrew/english if given); reject deletes the ref's
 * entry entirely so the next scheduled translation run's staleness check treats it as
 * never-generated and retries from scratch. Batches with any other still-open decision from this
 * module into one PR (see findOpenReviewPr) rather than opening a new one per call.
 */
export async function openReviewDecisionPr(
  request: ReviewDecisionRequest,
  token: string,
  fetchImpl: FetchFn = fetch,
): Promise<ReviewDecisionResult> {
  const {page, ref, decision, hebrew, english, reason} = request;
  const path = `precomputed/ai_additions/${page}.json`;
  const encodedPath = encodePath(path);

  const openPr = await findOpenReviewPr(fetchImpl, token);
  const branch = openPr?.headRef ?? `${BRANCH_PREFIX}${Date.now()}`;
  // Read from the batch branch itself (not base) when one exists — it may already carry an
  // earlier decision in this same batch, including one touching this exact page's file.
  const readRef = openPr ? branch : BASE_BRANCH;

  const file = await githubRequest<{content: string; sha: string}>(
    fetchImpl, token, `/repos/${REPO}/contents/${encodedPath}?ref=${readRef}`);
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

  if (!openPr) {
    const baseRef = await githubRequest<{object: {sha: string}}>(
      fetchImpl, token, `/repos/${REPO}/git/ref/heads/${BASE_BRANCH}`);
    await githubRequest(fetchImpl, token, `/repos/${REPO}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ref: `refs/heads/${branch}`, sha: baseRef.object.sha}),
    });
  }

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
  const entryLine = `${message} — via the review overlay at ${new Date().toISOString()}.`;

  if (openPr) {
    await githubRequest(fetchImpl, token, `/repos/${REPO}/pulls/${openPr.number}`, {
      method: "PATCH",
      body: JSON.stringify({body: `${openPr.body}\n${entryLine}`}),
    });
    return {url: `https://github.com/${REPO}/pull/${openPr.number}`};
  }

  const pr = await githubRequest<{html_url: string}>( // eslint-disable-line camelcase
    fetchImpl, token, `/repos/${REPO}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: "RSI review batch",
        head: branch,
        base: BASE_BRANCH,
        body: entryLine,
      }),
    });

  return {url: pr.html_url};
}
