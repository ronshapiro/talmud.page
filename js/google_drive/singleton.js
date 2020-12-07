/* global gapi */
import {DriveClient} from "./client.js";
import {IndexedDbUnsavedCommentStore} from "./IndexedDbUnsavedCommentStore.ts";

export const driveClient = new DriveClient(
  "766008139306-6n51cbgv7gns88mulhk0jjkjsceo4ve5.apps.googleusercontent.com", // client id
  "AIzaSyB2aZB3L8tZ7lf3F0IFIbb4OJTT1wqyDfA", // api key
  new IndexedDbUnsavedCommentStore(),
);

window.handleGoogleClientLoad = () => gapi.load("client:auth2", () => driveClient.init());
