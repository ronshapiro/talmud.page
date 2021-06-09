export interface CorrectionUiInfo {
  ref: string;
  url: string;
  hebrew: string | undefined;
  hebrewHighlighted: string | undefined;
  translation: string | undefined;
  translationHighlighted: string | undefined;
}

export interface CorrectionPostData extends CorrectionUiInfo {
  userText: string;
  user: string;
}
