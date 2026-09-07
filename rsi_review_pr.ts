import {Edit} from "./precomputed/ai_edits";

// Opens (or adds to) a PR against ai_edits.ts entries from plain HTTPS calls to the GitHub REST
// API — no git binary, no local checkout, so the server can remain stateless.
const REPO = "ronshapiro/talmud.page";
const BASE_BRANCH = "base";
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
  // This client's own last-known review PR number (see js/RsiReviewControls.tsx), reused if it's
  // still open. Deliberately per-client rather than "any open PR from this flow" — two reviewers
  // batching into the same shared PR could otherwise clash if they disagree on a change, or want
  // to submit their batches independently. Omitted, or no longer open, starts a fresh PR.
  knownPrNumber?: number;
  // Free-text name/email the reviewer entered once (see rsiReviewerIdentityPreference), for
  // PR/commit attribution — this codebase has no login system, so this is self-reported, not
  // verified. The review key only proves "a key-holder," not who.
  reviewerIdentity?: string;
}

export interface ReviewDecisionResult {
  url: string;
  // Returned so the caller can remember it as its own knownPrNumber for the next decision.
  prNumber: number;
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
 * Looks up the caller's own previously-opened review PR, if it gave one and it's still open —
 * see ReviewDecisionRequest.knownPrNumber for why this is scoped per-caller instead of "any open
 * PR from this flow."
 */
async function findKnownOpenPr(
  fetchImpl: FetchFn, token: string, knownPrNumber: number | undefined,
): Promise<OpenReviewPr | undefined> {
  if (!knownPrNumber) return undefined;
  type PrEntry = {number: number; state: string; head: {ref: string}; body: string | null};
  const pr = await githubRequest<PrEntry>(
    fetchImpl, token, `/repos/${REPO}/pulls/${knownPrNumber}`);
  if (pr.state !== "open") return undefined;
  return {number: pr.number, headRef: pr.head.ref, body: pr.body ?? ""};
}

/**
 * Approve (optionally with edited text) or reject a single pending ai_edits.ts entry. Approve
 * clears `status: "pending"` (and overwrites hebrew/english if given); reject deletes the ref's
 * entry entirely so the next scheduled translation run's staleness check treats it as
 * never-generated and retries from scratch. Batches with the caller's own still-open PR (see
 * ReviewDecisionRequest.knownPrNumber) rather than opening a new one per call.
 */
export async function openReviewDecisionPr(
  request: ReviewDecisionRequest,
  token: string,
  fetchImpl: FetchFn = fetch,
): Promise<ReviewDecisionResult> {
  const {page, ref, decision, hebrew, english, reason, knownPrNumber, reviewerIdentity} = request;
  const path = `precomputed/ai_additions/${page}.json`;
  const encodedPath = encodePath(path);

  const openPr = await findKnownOpenPr(fetchImpl, token, knownPrNumber);
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

  const attribution = reviewerIdentity ? ` by ${reviewerIdentity}` : "";
  const entryLine = `${message}${attribution} — via the review overlay at ${
    new Date().toISOString()}.`;

  if (openPr) {
    await githubRequest(fetchImpl, token, `/repos/${REPO}/pulls/${openPr.number}`, {
      method: "PATCH",
      body: JSON.stringify({body: `${openPr.body}\n${entryLine}`}),
    });
    return {url: `https://github.com/${REPO}/pull/${openPr.number}`, prNumber: openPr.number};
  }

  type NewPr = {html_url: string; number: number}; // eslint-disable-line camelcase
  const pr = await githubRequest<NewPr>(
    fetchImpl, token, `/repos/${REPO}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: "RSI review batch",
        head: branch,
        base: BASE_BRANCH,
        body: entryLine,
      }),
    });

  return {url: pr.html_url, prNumber: pr.number};
}
