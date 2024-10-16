import {amudMetadata} from "./amud.ts";
import {books} from "./books.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer} from "./rendering.jsx";
import {intToHebrewNumeral} from "../hebrew.ts";

// Consider merging impl with Mishna?
class TanakhRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("tanakh"),
      {
        previous: () => (parseInt(amudMetadata().amudStart) - 1).toString(),
        next: () => (parseInt(amudMetadata().amudEnd) + 1).toString(),

        hasPrevious: () => amudMetadata().amudStart !== "1",
        hasNext: () => {
          const metadata = amudMetadata();
          return metadata.amudEnd !== books[metadata.masechet].end;
        },
      }, {
        allowCompactLayout: true,
      });
  }

  newPageTitleHebrew(section) {
    const {hebrewName} = books[amudMetadata().masechet];
    return `${hebrewName} ${intToHebrewNumeral(parseInt(section))}`;
  }
}

new Runner(new TanakhRenderer(), driveClient, "tanakh").main();
