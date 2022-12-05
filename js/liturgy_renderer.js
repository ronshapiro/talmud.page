import {getCommentaryTypes} from "./commentaryTypes.ts";
import {Renderer} from "./rendering.jsx";

export class LiturgyRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("siddur"),
      {
        previous: () => undefined,
        next: () => undefined,
        hasPrevious: () => false,
        hasNext: () => false,
      },
      {
        expandTranslationOnMergedSectionExpansion: true,
        translationOverride: "both",
      },
    );
  }

  newPageTitle(section) {
    return section.replace(/_/g, " ");
  }
}
