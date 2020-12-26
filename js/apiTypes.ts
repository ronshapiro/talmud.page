export interface Amud {
  sections: Section[];
}

type TextType = string | string[];

export interface Commentary {
  comments: ApiComment[];
  commentary?: Record<string, Commentary> | undefined;
}

export interface Section {
  ref: string;
  commentary: Record<string, Commentary> | undefined;
  he: TextType;
  en: TextType;
  unhighlighted?: {he: string, en: string};
  hasHighlights?: boolean;
}

export interface ApiComment {
  ref: string;
  he: TextType;
  en: TextType;
  commentary?: Record<string, Commentary>;
  unhighlighted?: {he: TextType, en: TextType};
  hasHighlights?: boolean;
}
