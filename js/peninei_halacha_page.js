import {
  PenineiHalacha,
  PENINEI_HALACHA_INDEX,
  PENINEI_HALACHA_SECTIONS,
  PENINEI_HALACHA_SORTER,
} from "../books.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {amudMetadata} from "./amud.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer} from "./rendering.jsx";

const BOOK = new PenineiHalacha();
const HIGHEST_INDEX = PENINEI_HALACHA_SECTIONS.length - 1;

class PenineiHalachaRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("general"),
      false,
      localStorage.translationOption || "english-side-by-side",
      localStorage.wrapTranslations !== "false",
      localStorage.expandEnglishByDefault === "true",
      {
        previous: () => BOOK.previousPage(amudMetadata().amudStart),
        next: () => BOOK.nextPage(amudMetadata().amudEnd),

        hasPrevious: () => PENINEI_HALACHA_INDEX[amudMetadata().amudStart].index !== 0,
        hasNext: () => {
          const end = amudMetadata().amudEnd;
          return !end || PENINEI_HALACHA_INDEX[end].index !== HIGHEST_INDEX;
        },

        range: () => {
          const metadata = amudMetadata();
          if (!metadata.amudStart) {
            return [];
          }
          if (!metadata.amudEnd) {
            return [metadata.amudStart];
          }

          const pages = [];
          let i = PENINEI_HALACHA_INDEX[metadata.amudStart].index;
          const end = PENINEI_HALACHA_INDEX[metadata.amudEnd].index;
          for (; i <= end; i++) {
            pages.push(PENINEI_HALACHA_SECTIONS[i]);
          }
          return pages;
        },
      });
  }

  sortedAmudim() {
    const keys = Object.keys(this.allAmudim);
    keys.sort(PENINEI_HALACHA_SORTER);
    return keys.map(key => this.allAmudim[key]);
  }
}

new Runner(new PenineiHalachaRenderer(), driveClient).main();
