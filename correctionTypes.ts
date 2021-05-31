export interface CorrectionUiInfo {
  ref: string;
  url: string;
  hebrew: string;
  hebrewHighlighted: string | undefined;
  translation: string;
  translationHighlighted: string | undefined;
}

export interface CorrectionPostData extends CorrectionUiInfo {
  userText: string;
  user: string;
}
