/* eslint-disable @typescript-eslint/no-empty-interface */
import {UnaryFunction} from "../types";

export interface CommentSourceMetadata {
  startPercentage: number;
  endPercentage: number;
  wordCountStart: number;
  wordCountEnd: number;
  isEnglish: boolean;
}

export interface TextComment {
  text: string;
  commentSourceMetadata: CommentSourceMetadata;
}

export interface HighlightComment {
  highlight: true;
  commentSourceMetadata: CommentSourceMetadata;
}

export interface HighlightCommentWithText extends HighlightComment {
  text: string;
}

export type AnyComment = TextComment | HighlightComment;

export interface PostCommentParams {
  comment: AnyComment;
  selectedText: string;
  amud: string;
  ref: string;
  parentRef: string;
  id?: string;
  isRetry?: boolean;
}

export interface UnsavedComment {
  comment: AnyComment;
  amud: string;
  ref: string;
  parentRef: string;
  [x: string]: any;
}

export interface PersistedComment extends PostCommentParams {
  masechet: string;
}

export interface UnsavedCommentStore {
  init: UnaryFunction<DriveClient, void>;
  addUnsavedComment: UnaryFunction<PostCommentParams, string | undefined>;
  markCommentSaved: UnaryFunction<string, any>;
}

export interface DriveClient {
  postComment: (comment: PostCommentParams) => void;
  masechet: string;
}

// https://www.typescriptlang.org/docs/handbook/namespaces.html#aliases
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
