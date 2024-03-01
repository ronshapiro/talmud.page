import {books} from "./books.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {Renderer} from "./rendering.jsx";
import {amudMetadata, computePreviousAmud, computeNextAmud} from "./amud.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {formatDafInHebrew} from "../talmud.ts";

class TalmudRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("talmud"),
      {
        previous: () => computePreviousAmud(amudMetadata().amudStart),
        next: () => computeNextAmud(amudMetadata().amudEnd),

        hasPrevious: () => {
          const metadata = amudMetadata();
          const bounds = books[metadata.masechet];
          return metadata.amudStart !== bounds.start;
        },
        hasNext: () => {
          const metadata = amudMetadata();
          const bounds = books[metadata.masechet];
          return metadata.amudEnd !== bounds.end;
        },
      },
      {
        isTalmud: true,
        allowCompactLayout: true,
      });
  }

  newPageTitleHebrew(section) {
    const {hebrewName} = books[amudMetadata().masechet];
    return formatDafInHebrew(hebrewName, section);
  }
}


new Runner(new TalmudRenderer(), driveClient, "talmud").main();
