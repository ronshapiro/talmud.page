import {CorrectionPostData} from "../correctionTypes";
import {trackEvent} from "./analytics";
import {driveClient} from "./google_drive/singleton";
import {postWithRetry} from "./post";
import {timeoutPromise} from "./promises";
import {Button, snackbars} from "./snackbar";
import {isSiteLanguageHebrew} from "./settings";

let activeCorrectionSnackbarToken = 0;

export function resetCorrectionDismissTimerForTesting(): void {
  activeCorrectionSnackbarToken += 1;
}

export function postCorrection(data: Omit<CorrectionPostData, "user">): Promise<unknown> {
  const {ref, userText} = data;
  activeCorrectionSnackbarToken += 1;
  const expectedToken = activeCorrectionSnackbarToken;
  let isDismissed = false;

  const dismissButton: Button = {
    text: isSiteLanguageHebrew() ? "סגור" : "Dismiss",
    onClick: () => {
      isDismissed = true;
      snackbars.reportedIssueSent.hide();
    },
  };

  const initialMessage = isSiteLanguageHebrew()
    // TODO(language): ref should be localized
    ? `תיקון של ${ref} נשלח`
    : `Posted correction on ${ref}: ${userText}`;

  snackbars.reportedIssueSent.show(initialMessage, [dismissButton]);

  const promise = postWithRetry("/corrections", {
    ...data,
    user: driveClient.isSignedIn ? driveClient.gapi.getSignedInUserEmail() : undefined,
  }, {
    onError: (errorText) => {
      if (isDismissed || activeCorrectionSnackbarToken !== expectedToken) {
        return;
      }
      const messageWithPreviousError = errorText
        ? `${initialMessage}<br>${errorText}`
        : initialMessage;
      snackbars.reportedIssueSent.update(messageWithPreviousError, [dismissButton]);
    },
  });

  promise.then(() => trackEvent("event", "report_correction", {ref}));
  promise
    .then(() => timeoutPromise(2000))
    .then(() => {
      if (!isDismissed && activeCorrectionSnackbarToken === expectedToken) {
        snackbars.reportedIssueSent.hide();
      }
    });

  return promise;
}
