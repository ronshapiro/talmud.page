import * as React from "react";
import {ApiComment} from "../apiTypes";
import {flatten} from "../sefariaTextType";
import {postWithRetry} from "./post";
import {getRsiReviewKey} from "./rsiReviewKey";
import {snackbars} from "./snackbar";

const {useState} = React;

interface DecisionResponse {
  url?: string;
}

type Decision = "approve" | "reject";

async function postDecision(
  page: string,
  ref: string,
  decision: Decision,
  extra: {hebrew?: string; english?: string; reason?: string} = {},
): Promise<void> {
  const label = decision === "approve" ? "Approved" : "Rejected";
  try {
    const response = await postWithRetry("/api/rsi-review-decision", {
      page, ref, decision, key: getRsiReviewKey(), ...extra,
    }) as DecisionResponse;
    const link = response?.url ? ` — <a href="${response.url}" target="_blank">view PR</a>` : "";
    snackbars.reportedIssueSent.show(`${label} ${ref}${link}`, []);
  } catch (e) {
    console.error(e);
    snackbars.errors.show(`Failed to submit review decision for ${ref}`, []);
  }
}

/**
 * Approve/edit/reject controls for a single pending AI-generated comment (comment.pendingReview
 * set — see api_request_handler.ts's addAiAdditions). Rendered inline in IndividualComment.tsx
 * for every reader, but only shown when a review key has been acquired (see rsiReviewKey.ts) —
 * the endpoint itself independently re-checks the key, so this is a rendering convenience, not
 * the actual security boundary.
 */
export function RsiReviewControls({comment}: {comment: ApiComment}): React.ReactElement | null {
  const [editing, setEditing] = useState(false);
  const [hebrew, setHebrew] = useState(() => flatten(comment.he) ?? "");
  const [english, setEnglish] = useState(() => flatten(comment.en) ?? "");

  const page = comment.pendingReview;
  if (!page || !getRsiReviewKey()) return null;

  if (editing) {
    return (
      <div className="rsi-review-controls rsi-review-editing">
        <textarea
          dir="rtl"
          value={hebrew}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setHebrew(e.target.value)} />
        <textarea
          dir="ltr"
          value={english}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEnglish(e.target.value)} />
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            postDecision(page, comment.ref, "approve", {hebrew, english});
          }}>
          Submit edit
        </button>
        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="rsi-review-controls">
      <button type="button" onClick={() => postDecision(page, comment.ref, "approve")}>
        Approve
      </button>
      <button type="button" onClick={() => setEditing(true)}>Edit</button>
      <button
        type="button"
        onClick={() => {
          // eslint-disable-next-line no-alert
          const reason = window.prompt("Reason (optional):") ?? undefined;
          postDecision(page, comment.ref, "reject", {reason});
        }}>
        Reject
      </button>
    </div>
  );
}
