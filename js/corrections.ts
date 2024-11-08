import {CorrectionPostData} from "../correctionTypes";
import {driveClient} from "./google_drive/singleton";
import {postWithRetry} from "./post";
import {timeoutPromise} from "./promises";
import {snackbars} from "./snackbar";

export function postCorrection(data: Omit<CorrectionPostData, "user">): Promise<unknown> {
  const {ref, userText} = data;
  snackbars.reportedIssueSent.show(`Posted correction on ${ref}: ${userText}`, []);

  const promise = postWithRetry("/corrections", {
    ...data,
    user: driveClient.gapi.getSignedInUserEmail(),
  });

  promise.then(() => gtag("event", "report_correction", {ref}));
  promise
    .then(() => timeoutPromise(2000))
    .then(() => snackbars.reportedIssueSent.hide());

  return promise;
}
