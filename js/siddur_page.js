import {amudMetadata} from "./amud.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer} from "./rendering.jsx";
import {SIDDUR_SECTIONS} from "./siddur.ts";

function pageIndex(name) {
  return SIDDUR_SECTIONS.indexOf(name.replace(/_/g, " "));
}

function siddurSectionDiff(name, diff) {
  return SIDDUR_SECTIONS[pageIndex(name) + diff].replace(/ /g, "_");
}

const FIRST_PAGE = SIDDUR_SECTIONS[0].replace(/ /g, "_");
const LAST_PAGE = SIDDUR_SECTIONS.slice(-1)[0].replace(/ /g, "_");

class SiddurRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("siddur"),
      false,
      "both",
      localStorage.wrapTranslations !== "false",
      localStorage.expandEnglishByDefault === "true",
      {
        previous: () => siddurSectionDiff(amudMetadata().amudStart, -1),
        next: () => siddurSectionDiff(amudMetadata().amudEnd, 1),

        hasPrevious: () => amudMetadata().amudStart !== FIRST_PAGE,
        hasNext: () => amudMetadata().amudEnd !== LAST_PAGE,
      });
  }

  sortedAmudim() {
    const keys = Object.keys(this.allAmudim);
    keys.sort((first, second) => pageIndex(first) - pageIndex(second));
    return keys.map(key => this.allAmudim[key]);
  }

  newPageTitle(section) {
    return section.replace(/_/g, " ");
  }

  ignoredSectionRefs() {
    const day = new Date().getDay();
    const ignored = [];
    const shirShelYomPrefix = "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day ";
    for (let dayValue = 0; dayValue < 6; dayValue++) {
      if (day !== dayValue) {
        const offset = 3 * dayValue;
        ignored.push(shirShelYomPrefix + (3 + offset), shirShelYomPrefix + (4 + offset));
      }
    }
    if (day !== 1 && day !== 4) {
      const prefixA = (
        "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, For Monday and Thursday ");
      for (let refIndex = 1; refIndex <= 8; refIndex++) {
        ignored.push(prefixA + refIndex);
      }

      const prefixB = (
        "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel ");
      for (let refIndex = 1; refIndex <= 11; refIndex++) {
        ignored.push(prefixB + refIndex);
      }
    }
    return ignored;
  }
}

const renderer = new SiddurRenderer();
window.renderer = renderer;

new Runner(renderer, driveClient, "siddur").main();
