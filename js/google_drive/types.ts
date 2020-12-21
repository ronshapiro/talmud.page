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

// TODO: make some of the properties requried
export interface Color extends gapi.client.docs.OptionalColor {}
export interface Request extends gapi.client.docs.Request {}

export interface TextStyle extends gapi.client.docs.TextStyle {}

export interface Range {
  startIndex: number;
  endIndex: number;
}

export interface LanguageStats {
  hebrew: number;
  english: number;
}

export interface TextRun {
  content: string;
  textStyle?: any;
}

export interface ParagraphElement {
  startIndex: number;
  endIndex: number;
  textRun: TextRun;
  languageStats?: LanguageStats;
}
