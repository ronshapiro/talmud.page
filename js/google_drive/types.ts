/* eslint-disable @typescript-eslint/no-empty-interface */
// @ts-ignore
import {UnaryFunction} from "../types.ts";

export interface UnsavedComment {
  text: string;
  amud: string;
  ref: string;
  parentRef: string;
}

export interface PersistedComment extends UnsavedComment {
  masechet: string;
}

export interface UnsavedCommentStore {
  init: UnaryFunction<DriveClient, void>;
  addUnsavedComment: UnaryFunction<UnsavedComment, string | undefined>;
  markCommentSaved: UnaryFunction<string, any>;
}

export interface DriveClient {
  postComment: UnaryFunction<UnsavedComment, void>;
  masechet: string;
}

export interface Color extends gapi.client.docs.OptionalColor {}
export interface Request extends gapi.client.docs.Request {}
export interface Range extends gapi.client.docs.Range {}
