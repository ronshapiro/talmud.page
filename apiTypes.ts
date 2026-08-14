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
  startOfSection?: true;
  lastSegmentOfSection?: true;
  defaultMergeWithNext?: true;
}

export interface Row {
  hebrew?: string;
  english?: string;
  image?: string;
  ref?: string;
}

export interface ApiComment extends Highlightable {
  ref: string;
  he: sefaria.TextType;
  en: sefaria.TextType;
  rows?: Row[];
  sourceRef: string;
  sourceHeRef: string;
  link?: string;
  commentary?: CommentaryMap;
  originalRefsBeforeRewriting?: string[];
  expandedRefsAfterRewriting?: string[];
  duplicateRefs?: string[];
  isUnique?: boolean;
  canReplaceParent?: boolean;
  didModifyUiWithAiVersion?: boolean;
}

export interface ApiResponse {
  title: string;
  titleHebrew: string;
  id: string;
  sections: Section[];
  // Refs that existed before a local segmentation override (precomputed/segmentation_overrides.ts)
  // split or merged them, and no longer exist on the page. A personal note/highlight saved under
  // one of these refs will no longer be found by the usual ref-keyed lookup — see
  // js/checkReplacedRefs.ts, which surfaces a warning for that case rather than letting it happen
  // silently. Only present when non-empty.
  replacedRefs?: string[];
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
