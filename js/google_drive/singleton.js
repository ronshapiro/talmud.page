/* global gapi */
import {amudMetadata} from "../amud.ts";
import {RealGoogleApiClient} from "./gapi.ts";
import {DriveClient} from "./client.js";
import {IndexedDbUnsavedCommentStore} from "./IndexedDbUnsavedCommentStore.ts";

export const driveClient = new DriveClient(
  new RealGoogleApiClient(
    "AIzaSyB2aZB3L8tZ7lf3F0IFIbb4OJTT1wqyDfA", // api key
    "766008139306-6n51cbgv7gns88mulhk0jjkjsceo4ve5.apps.googleusercontent.com", // client id
  ),
  new IndexedDbUnsavedCommentStore(),
  amudMetadata().masechet,
  window.location.hostname === "localhost",
);

window.handleGoogleClientLoad = () => gapi.load("client:auth2", () => driveClient.init());
