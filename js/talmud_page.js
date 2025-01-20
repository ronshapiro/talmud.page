import {books} from "./books.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {Renderer} from "./Renderer.tsx";
import {amudMetadata, computePreviousAmud, computeNextAmud} from "./amud.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {formatDafInHebrew} from "../talmud.ts";

function translatePage(page) {
  return localStorage.languageOption === "hebrew" ? formatDafInHebrew("", page).slice(1) : page;
}

const previous = () => computePreviousAmud(amudMetadata().amudStart);
const next = () => computeNextAmud(amudMetadata().amudEnd);

class TalmudRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("talmud"),
      {
        previous,
        next,
        displayPrevious: () => translatePage(previous()),
        displayNext: () => translatePage(next()),

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


new Runner(new TalmudRenderer(), driveClient).main();
