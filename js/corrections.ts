import {CorrectionPostData} from "../correctionTypes";
import {trackEvent} from "./analytics";
import {driveClient} from "./google_drive/singleton";
import {postWithRetry} from "./post";
import {timeoutPromise} from "./promises";
import {snackbars} from "./snackbar";
import {isSiteLanguageHebrew} from "./settings";

export function postCorrection(data: Omit<CorrectionPostData, "user">): Promise<unknown> {
  const {ref, userText} = data;
  snackbars.reportedIssueSent.show(
    isSiteLanguageHebrew()
      // TODO(language): ref should be localized
      ? `תיקון של ${ref} נשלח`
      : `Posted correction on ${ref}: ${userText}`,
    []);

  const promise = postWithRetry("/corrections", {
    ...data,
    user: driveClient.gapi.getSignedInUserEmail(),
  });

  promise.then(() => trackEvent("event", "report_correction", {ref}));
  promise
    .then(() => timeoutPromise(2000))
    .then(() => snackbars.reportedIssueSent.hide());

  return promise;
}
