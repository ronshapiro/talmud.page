import {amudMetadata, tryReadHardcodedSections} from "./amud.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer} from "./Renderer.tsx";
import {penineiHalachaHebrewTitleName} from "../hebrew";
import {books} from "./books";

class PenineiHalachaRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("peninei halacha"),
      {
        previous: () => {
          const sections = tryReadHardcodedSections();
          return sections[sections.indexOf(amudMetadata().amudStart) - 1];
        },
        next: () => {
          const sections = tryReadHardcodedSections();
          return sections[sections.indexOf(amudMetadata().amudEnd) + 1];
        },

        hasPrevious: () => {
          return tryReadHardcodedSections()[0] !== amudMetadata().amudStart;
        },
        hasNext: () => {
          return tryReadHardcodedSections().at(-1) !== amudMetadata().amudEnd;
        },

      },
      {allowCompactLayout: false});
  }

  newPageTitleHebrew(section) {
    return penineiHalachaHebrewTitleName(books[amudMetadata().masechet].hebrewName, section);
  }
}

new Runner(new PenineiHalachaRenderer(), driveClient).main();
