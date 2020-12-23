import {driveClient} from "./google_drive/singleton";
import {amudMetadata} from "./amud";

let hasReceivedUpdateFromApi = false;

function setErrors(errors: string[]): void {
  document.getElementById("errors")!.innerHTML = errors.map(x => `<li>${x}</li>`).join("");
}

function hideProgressBar() {
  document.getElementById("progress-bar")!.hidden = true;
}

driveClient.databaseUpdatedListener = () => {
  hasReceivedUpdateFromApi = true;
  if (driveClient.databaseDocumentShouldBeCreated) {
    setErrors([`No notes document exists yet for ${amudMetadata().masechet}.`]);
    hideProgressBar();
  } else {
    window.location.replace(
      `https://docs.google.com/document/d/${driveClient.databaseDocument.documentId}/edit`);
  }
};

driveClient.onErrorListener = () => setErrors(Object.values(driveClient.errors));

driveClient.signInStatusListener = () => {
  hasReceivedUpdateFromApi = true;
  if (!driveClient.isSignedIn) {
    setErrors(["You're not logged in!"]);
    hideProgressBar();
  }
};

setTimeout(() => {
  if (!hasReceivedUpdateFromApi) {
    setErrors(["Can't connect to Google. Are you logged in?"]);
    hideProgressBar();
  }
}, 10 * 60 * 1000);
