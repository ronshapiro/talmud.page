import {getCommentaryTypes} from "./commentaryTypes.ts";
import {Renderer} from "./Renderer.tsx";

export class LiturgyRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("siddur"),
      {
        disableNavigation: true,
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

  rendererType() { return "Liturgy"; }
}
