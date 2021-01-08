// eslint-disable-next-line @typescript-eslint/triple-slash-reference,spaced-comment
/// <reference path="sefaria.d.ts" />

export interface Amud {
  sections: Section[];
}

export type CommentaryMap = Record<string, Commentary>;

export interface Commentary {
  comments: ApiComment[];
  commentary?: CommentaryMap;
}

interface Highlightable {
  unhighlighted?: {he: sefaria.TextType, en: sefaria.TextType};
  hasHighlights?: boolean;
}

export interface Section extends Highlightable {
  ref: string;
  he: sefaria.TextType;
  en: sefaria.TextType;
  commentary?: CommentaryMap;

  hadran?: true;
  steinsaltz_start_of_sugya?: true; // eslint-disable-line camelcase
}

export interface ApiComment extends Highlightable {
  ref: string;
  he: sefaria.TextType;
  en: sefaria.TextType;
  sourceRef: string;
  sourceHeRef: string;
  link?: string;
}

export interface ApiResponse {
  title: string;
  id: string;
  sections: Section[];
}
