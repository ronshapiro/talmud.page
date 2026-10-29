import {CorrectionPostData} from "../correctionTypes";
import {trackEvent} from "./analytics";
import {driveClient} from "./google_drive/singleton";
import {post} from "./post";
import {timeoutPromise} from "./promises";
import {Button, snackbars} from "./snackbar";
import {isSiteLanguageHebrew} from "./settings";

export const CORRECTION_ERROR_AUTO_DISMISS_DELAY_MILLISECONDS = 10000;

let errorDismissTimeout: ReturnType<typeof setTimeout> | undefined;

export function resetCorrectionDismissTimerForTesting(): void {
  if (errorDismissTimeout !== undefined) {
    clearTimeout(errorDismissTimeout);
    errorDismissTimeout = undefined;
  }
}

export function postCorrection(data: Omit<CorrectionPostData, "user">): Promise<unknown> {
  const {ref, userText} = data;
  snackbars.reportedIssueSent.show(
    isSiteLanguageHebrew()
      // TODO(language): ref should be localized
      ? `תיקון של ${ref} נשלח`
      : `Posted correction on ${ref}: ${userText}`,
    []);

  const promise = post("/corrections", {
    ...data,
    user: driveClient.isSignedIn ? driveClient.gapi.getSignedInUserEmail() : undefined,
  });

  return promise
    .then(() => {
      trackEvent("event", "report_correction", {ref});
      return timeoutPromise(2000);
    })
    .then(() => {
      snackbars.reportedIssueSent.hide();
    })
    .catch((error) => {
      console.error(error);
      snackbars.reportedIssueSent.hide();
      resetCorrectionDismissTimerForTesting();

      const dismissButton: Button = {
        text: isSiteLanguageHebrew() ? "סגור" : "Dismiss",
        onClick: () => {
          resetCorrectionDismissTimerForTesting();
          snackbars.errors.hide();
        },
      };

      snackbars.errors.show(
        isSiteLanguageHebrew()
          ? `שגיאה בשליחת תיקון של ${ref}`
          : `Failed to post correction on ${ref}`,
        [dismissButton]);

      errorDismissTimeout = setTimeout(() => {
        resetCorrectionDismissTimerForTesting();
        snackbars.errors.hide();
      }, CORRECTION_ERROR_AUTO_DISMISS_DELAY_MILLISECONDS);
    });
}
