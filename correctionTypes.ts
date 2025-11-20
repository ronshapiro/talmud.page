export interface CorrectionUiInfo {
  ref: string;
  hebrew: string | undefined;
  hebrewHighlighted: string | undefined;
  translation: string | undefined;
  translationHighlighted: string | undefined;
  pathname: string,
  isAiEdit: boolean;
}

export interface CorrectionPostData extends CorrectionUiInfo {
  userText: string;
  user: string;
}
