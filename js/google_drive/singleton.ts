/* global gapi */
import {amudMetadata} from "../amud";
import {RealGoogleApiClient} from "./gapi";
import {DriveClient} from "./client";
import {IndexedDbUnsavedCommentStore} from "./IndexedDbUnsavedCommentStore";

export const driveClient = new DriveClient(
  new RealGoogleApiClient(
    "AIzaSyB2aZB3L8tZ7lf3F0IFIbb4OJTT1wqyDfA", // api key
    "766008139306-6n51cbgv7gns88mulhk0jjkjsceo4ve5.apps.googleusercontent.com", // client id
  ),
  new IndexedDbUnsavedCommentStore(),
  amudMetadata().databaseTitleOverride ?? amudMetadata().masechet,
  window.location.hostname === "localhost",
);

let initCalled = false;

function init() {
  if (initCalled) {
    return;
  }
  initCalled = true;
  gapi.load("client:auth2", () => driveClient.init());
}

(window as any).handleGoogleClientLoad = () => {
  // @ts-ignore
  if (("connection" in navigator && navigator.connection.downlink !== 0)
    || navigator.onLine) {
    init();
  } else {
    window.addEventListener("online", init);
  }
};
