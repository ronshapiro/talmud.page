// eslint-disable-next-line @typescript-eslint/triple-slash-reference,spaced-comment
/// <reference path="sefaria.d.ts" />

import {HighlightColor} from "./js/google_drive/types";

export interface Amud {
  id: string;
  sections: Section[];
}

export type CommentaryMap = Record<string, Commentary>;

export interface Commentary {
  comments: ApiComment[];
}

interface Highlightable {
  unhighlighted?: {he: sefaria.TextType, en: sefaria.TextType};
  highlightColors?: Set<HighlightColor>;
}

export interface Section extends Highlightable {
  ref: string;
  he: sefaria.TextType;
  en: sefaria.TextType;
  commentary?: CommentaryMap;

  hadran?: true;
  steinsaltz_start_of_sugya?: true; // eslint-disable-line camelcase
  lastSegmentOfSection?: true;
  defaultMergeWithNext?: true;
}

export interface ApiComment extends Highlightable {
  ref: string;
  he: sefaria.TextType;
  en: sefaria.TextType;
  sourceRef: string;
  sourceHeRef: string;
  link?: string;
  commentary?: CommentaryMap;
  originalRefsBeforeRewriting?: string[];
  expandedRefsAfterRewriting?: string[];
}

export interface ApiResponse {
  title: string;
  titleHebrew: string;
  id: string;
  sections: Section[];
}

export interface ApiErrorResponse {
  error: string;
  code?: number;
  id?: string;
}

export interface QueryGuess {
  text: string;
  url: string;
}

export interface QueryGuesses {
  guesses: QueryGuess[];
}
