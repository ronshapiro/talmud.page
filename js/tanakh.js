import {amudMetadata} from "./amud.ts";
import {books} from "./books.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer} from "./rendering.jsx";

class TanakhRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("tanakh"),
      false,
      localStorage.translationOption || "english-side-by-side",
      localStorage.wrapTranslations !== "false",
      localStorage.expandEnglishByDefault === "true",
      {
        previous: () => (parseInt(amudMetadata().amudStart) - 1).toString(),
        next: () => (parseInt(amudMetadata().amudEnd) + 1).toString(),

        hasPrevious: () => amudMetadata().amudStart !== "1",
        hasNext: () => {
          const metadata = amudMetadata();
          return metadata.amudEnd !== books[metadata.masechet].end;
        },
      });
  }

  sortedAmudim() {
    const keys = Object.keys(this.allAmudim);
    keys.sort((first, second) => parseInt(first) - parseInt(second));
    return keys.map(key => this.allAmudim[key]);
  }
}

new Runner(new TanakhRenderer(), driveClient, "tanakh").main();
