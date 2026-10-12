import * as React from "react";
import {ApiComment} from "../apiTypes";
import {flatten} from "../sefariaTextType";
import {useHtmlRef} from "./hooks";
import {$} from "./jquery";
import Modal from "./Modal";
import {postWithRetry} from "./post";
import {getRsiReviewKey} from "./rsiReviewKey";
import {
  isSiteLanguageHebrew,
  rsiReviewerIdentityPreference,
  rsiReviewPrNumberPreference,
} from "./settings";
import {Button, snackbars, Snackbar} from "./snackbar";

const {useState} = React;

export const AUTO_DISMISS_DELAY_MILLISECONDS = 10000;

let autoDismissTimeout: ReturnType<typeof setTimeout> | undefined;
let activeSnackbarToken = 0;

function clearAutoDismissTimer(): void {
  if (autoDismissTimeout !== undefined) {
    clearTimeout(autoDismissTimeout);
    autoDismissTimeout = undefined;
  }
}

export function resetSnackbarDismissTimerForTesting(): void {
  clearAutoDismissTimer();
  activeSnackbarToken = 0;
}

function isSnackbarStillPresent(snackbar: Snackbar): boolean {
  const snackbarRoot = $("#snackbar");
  if (snackbarRoot.length > 0) {
    return snackbarRoot.find(`.${snackbar.kind.cssClass}`).length > 0;
  }
  return true;
}

function showSnackbarWithAutoDismiss(
  snackbar: Snackbar,
  updateAction: (dismissButton: Button) => void,
): void {
  clearAutoDismissTimer();
  activeSnackbarToken += 1;
  const expectedToken = activeSnackbarToken;

  const dismissButton: Button = {
    text: isSiteLanguageHebrew() ? "סגור" : "Dismiss",
    onClick: () => {
      if (activeSnackbarToken === expectedToken) {
        clearAutoDismissTimer();
        activeSnackbarToken += 1;
      }
      snackbar.hide();
    },
  };

  updateAction(dismissButton);

  autoDismissTimeout = setTimeout(() => {
    if (activeSnackbarToken === expectedToken) {
      activeSnackbarToken += 1;
      autoDismissTimeout = undefined;
      if (isSnackbarStillPresent(snackbar)) {
        snackbar.hide();
      }
    }
  }, AUTO_DISMISS_DELAY_MILLISECONDS);
}

interface DecisionResponse {
  url?: string;
  prNumber?: number;
}

type Decision = "approve" | "reject";

async function postDecision(
  page: string,
  ref: string,
  decision: Decision,
  extra: {
    hebrew?: string;
    english?: string;
    fallbackHebrew?: string;
    fallbackEnglish?: string;
    reason?: string;
  },
  reviewerIdentity: string,
): Promise<void> {
  const label = decision === "approve" ? "Approved" : "Rejected";
  const knownPrNumberString = rsiReviewPrNumberPreference.get();
  const knownPrNumber = knownPrNumberString ? Number(knownPrNumberString) : undefined;

  clearAutoDismissTimer();
  activeSnackbarToken += 1;
  snackbars.reportedIssueSent.show(`Submitting ${decision} for ${ref}…`, []);
  try {
    const response = await postWithRetry("/api/rsi-review-decision", {
      page, ref, decision, key: getRsiReviewKey(), knownPrNumber, reviewerIdentity, ...extra,
    }) as DecisionResponse;
    if (response?.prNumber !== undefined) {
      rsiReviewPrNumberPreference.set(String(response.prNumber));
    }
    const link = response?.url ? ` — <a href="${response.url}" target="_blank">view PR</a>` : "";
    showSnackbarWithAutoDismiss(snackbars.reportedIssueSent, dismissButton => {
      snackbars.reportedIssueSent.update(`${label} ${ref}${link}`, [dismissButton]);
    });
  } catch (error) {
    console.error(error);
    clearAutoDismissTimer();
    activeSnackbarToken += 1;
    snackbars.reportedIssueSent.hide();
    showSnackbarWithAutoDismiss(snackbars.errors, dismissButton => {
      snackbars.errors.show(`Failed to submit review decision for ${ref}`, [dismissButton]);
    });
  }
}

type ModalState =
  | {kind: "identity"; onIdentity: (identity: string) => void}
  | {kind: "reject"; identity: string};

/**
 * Approve/edit/reject controls for a single pending AI-generated comment (comment.pendingReview
 * set. Rendered inline in IndividualComment for every reader, but only shown when a review key
 * has been acquired.
 */
export function RsiReviewControls({comment}: {comment: ApiComment}): React.ReactElement | null {
  const [editing, setEditing] = useState(false);
  const [hebrew, setHebrew] = useState(() => flatten(comment.he) ?? "");
  const [english, setEnglish] = useState(() => flatten(comment.en) ?? "");
  const [modal, setModal] = useState<ModalState | null>(null);
  const identityInputRef = useHtmlRef<HTMLInputElement>();
  const reasonRef = useHtmlRef<HTMLTextAreaElement>();

  const page = comment.pendingReview;
  if (!page || !getRsiReviewKey()) return null;

  // Runs `onIdentity` with the reviewer's self-reported name/email, prompting for it via a modal
  // the first time (then remembered in localStorage) — every action needs one, so this is the
  // single gate all three buttons go through rather than duplicating the prompt-then-proceed
  // logic per button.
  const withIdentity = (onIdentity: (identity: string) => void): void => {
    const existing = rsiReviewerIdentityPreference.get();
    if (existing) {
      onIdentity(existing);
      return;
    }
    setModal({kind: "identity", onIdentity});
  };

  const fallbackHebrew = flatten(comment.he) || undefined;
  const fallbackEnglish = flatten(comment.en) || undefined;

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
        <div className="rsi-review-editing-actions">
          <button
            type="button"
            className="rsi-review-button rsi-review-submit-edit"
            onClick={() => withIdentity(identity => {
              setEditing(false);
              postDecision(page, comment.ref, "approve", {
                hebrew,
                english,
                fallbackHebrew,
                fallbackEnglish,
              }, identity);
            })}>
            Submit edit
          </button>
          <button
            type="button"
            className="rsi-review-button rsi-review-cancel"
            onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rsi-review-controls">
      <button
        type="button"
        className="rsi-review-button rsi-review-approve"
        onClick={() => withIdentity(
          identity => postDecision(page, comment.ref, "approve", {
            fallbackHebrew,
            fallbackEnglish,
          }, identity))}>
        Approve
      </button>
      <button
        type="button"
        className="rsi-review-button rsi-review-edit"
        onClick={() => setEditing(true)}>
        Edit
      </button>
      <button
        type="button"
        className="rsi-review-button rsi-review-reject"
        onClick={() => withIdentity(identity => setModal({kind: "reject", identity}))}>
        Reject
      </button>
      {modal?.kind === "identity" && (
        <Modal
          content={(
            <div>
              <p>Your name or email, so your changes can be attributed:</p>
              <input ref={identityInputRef} type="text" className="mdl-textfield__input" />
            </div>
          )}
          cancelText="Cancel"
          cancelTextHebrew="בטל"
          onCancel={() => setModal(null)}
          acceptText="Save"
          acceptTextHebrew="שמור"
          onAccept={() => {
            const identity = identityInputRef.current?.value.trim();
            if (!identity) return;
            rsiReviewerIdentityPreference.set(identity);
            const {onIdentity} = modal;
            setModal(null);
            onIdentity(identity);
          }} />
      )}
      {modal?.kind === "reject" && (
        <Modal
          content={(
            <div>
              <p>Reason (optional):</p>
              <textarea ref={reasonRef} className="mdl-textfield__input" />
            </div>
          )}
          cancelText="Cancel"
          cancelTextHebrew="בטל"
          onCancel={() => setModal(null)}
          acceptText="Reject"
          acceptTextHebrew="דחה"
          onAccept={() => {
            const reason = reasonRef.current?.value.trim() || undefined;
            const {identity} = modal;
            setModal(null);
            postDecision(page, comment.ref, "reject", {reason}, identity);
          }} />
      )}
    </div>
  );
}
