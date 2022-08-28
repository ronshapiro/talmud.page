import * as _ from "underscore";
import {JewishCalendar, ZmanimCalendar} from "kosher-zmanim";
import {amudMetadata} from "./amud.ts";
import {ApiCache} from "./ApiCache.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {onceDocumentReady} from "./once_document_ready.ts";
import {Runner} from "./page_runner.js";
import {Renderer} from "./rendering.jsx";
import {SIDDUR_SECTIONS} from "./siddur.ts";

const INJECT_WEEKDAY_TORAH_PORTION_AFTER_REF = (
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Birkat Hatorah 6");

function pageIndex(name) {
  return SIDDUR_SECTIONS.indexOf(name.replace(/_/g, " "));
}

function siddurSectionDiff(name, diff) {
  return SIDDUR_SECTIONS[pageIndex(name) + diff].replace(/ /g, "_");
}

const FIRST_PAGE = SIDDUR_SECTIONS[0].replace(/ /g, "_");
const LAST_PAGE = SIDDUR_SECTIONS.slice(-1)[0].replace(/ /g, "_");

function refRanges(prefix, startIndex, endIndex) {
  return _.range(startIndex, endIndex + 1).map(x => prefix + x);
}

function getJewishDate() {
  const date = new JewishCalendar();
  date.setInIsrael(Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Jerusalem");
  return date;
}

function mashivHaruach() {
  const today = getJewishDate();
  return (today.getJewishMonth() === 1 && today.getJewishDayOfMonth() < 15)
    || (today.getJewishMonth() === 7 && today.getJewishDayOfMonth() > 15)
    || today.getJewishMonth() > 7;
}

function isAfterTzais() {
  return new ZmanimCalendar().getTzais().diffNow().milliseconds > 0;
}

function vtenTalUmatar() {
  const today = getJewishDate();
  if (today.getJewishMonth() === 1 && today.getJewishDayOfMonth() < 15) {
    return true;
  }
  if (today.getInIsrael()) {
    return (today.getJewishMonth() === 8 && today.getJewishDayOfMonth() >= 7)
      || today.getJewishMonth() > 8;
  }

  const luxonDate = today.getDate();
  if (luxonDate.month === 12) {
    const isNextYearLeapYear = luxonDate.plus({months: 1}).isInLeapYear;
    return luxonDate.day >= (isNextYearLeapYear ? 5 : 4)
      || (luxonDate.day >= (isNextYearLeapYear ? 5 : 4) && isAfterTzais());
  }
  return luxonDate.month === 1
    || luxonDate.month === 2
    || today.getJewishMonth() >= 11;
}

const NO_TACHANUN_DAYS = new Set([
  JewishCalendar.PESACH_SHENI,
  JewishCalendar.PURIM,
  JewishCalendar.SHUSHAN_PURIM,
  JewishCalendar.YOM_HAATZMAUT,
  JewishCalendar.YOM_YERUSHALAYIM,
  JewishCalendar.LAG_BAOMER,
  JewishCalendar.TISHA_BEAV,
  JewishCalendar.TU_BEAV,
  JewishCalendar.TU_BESHVAT,
  JewishCalendar.EREV_ROSH_HASHANA,
]);

if (NO_TACHANUN_DAYS.has(undefined)) {
  throw new Error(NO_TACHANUN_DAYS);
}

function omitTachanun() {
  const today = getJewishDate();
  return today.isRoshChodesh()
    || today.getJewishMonth() === 1
    || (today.getJewishMonth() === 3 && today.getJewishDayOfMonth() <= 12)
    || (today.getJewishMonth() === 7 && today.getJewishDayOfMonth() >= 9)
    || today.isChanukah()
    || (today.getJewishMonth() === JewishCalendar.ADAR && ( // Adar Aleph
      today.getJewishDayOfMonth() === 14 || today.getJewishDayOfMonth() === 15))
    || NO_TACHANUN_DAYS.has(today.getYomTovIndex());
}

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
    let keys = Object.keys(this.allAmudim);
    keys.sort((first, second) => pageIndex(first) - pageIndex(second));

    if ("Torah" in this.allAmudim && this.injectedTorahPortions) {
      const torahSection = this.allAmudim.Torah;
      const splitPoint = torahSection.sections.findIndex(
        section => section.ref === INJECT_WEEKDAY_TORAH_PORTION_AFTER_REF) + 1;
      if (splitPoint !== 0) {
        let newSections = torahSection.sections.slice(0, splitPoint);
        for (let i = 0; i < this.injectedTorahPortions.aliyot.length; i++) {
          const aliya = this.injectedTorahPortions.aliyot[i];
          const hebrewIndex = ["א", "ב", "ג", "ד"][i];
          newSections.push({
            commentary: {},
            he: `<strong>עליה ${hebrewIndex}'</strong>`,
            en: "",
            ref: `synthetic-aliyah-${i + 1}`,
            steinsaltz_start_of_sugya: true,
          });
          newSections = newSections.concat(aliya.sections);
        }
        newSections = newSections.concat(torahSection.sections.slice(splitPoint));
        torahSection.sections = newSections;
        this.injectedTorahPortions = undefined;
      }
    }

    if (omitTachanun()) {
      keys = keys.filter(key => key !== "Tachanun");
    }

    return keys.map(key => this.allAmudim[key]);
  }

  injectTorahPortion(portionRespones) {
    this.injectedTorahPortions = portionRespones;
    this.forceUpdate();
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
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, For Monday and Thursday ",
        1, 8));
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel ", 1, 11));
    }
    if (omitTachanun()) {
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah ", 5, 9));
    }

    const hebrewDay = getJewishDate();
    if (!hebrewDay.isRoshChodesh()) {
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Barchi Nafshi ", 1, 8));
    }

    if (!hebrewDay.jewishMonth !== 6) {
      ignored.push(...refRanges("Psalms 27:", 1, 14));
    }

    if (mashivHaruach()) {
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 2-3");
    } else {
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 4-5");
    }

    // TODO(siddur): highlight this in the first 30 days
    if (vtenTalUmatar()) {
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 2-3");
    } else {
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Prosperity 4-5");
    }

    // TODO: Highlight all of these!
    if (hebrewDay.isAseresYemeiTeshuva()) {
      ignored.push(...[
        "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 2",
        "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 2",
      ]);
    } else {
      ignored.push(
        ...[
          "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs 4",
          "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs 5",
          "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Divine Might 8",
          "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Holiness of God 3",
          "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Justice 3",
          "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 10",
          "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Peace 2",
        ].concat(
          _.range(1, 9).map(x => `Psalms 130:${x}`),
        ));
    }

    if (!hebrewDay.isTaanis()) {
      ignored.push("tp::Annenu");
    }

    if (!hebrewDay.isTaanis() && !hebrewDay.isAseresYemeiTeshuva()) {
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Avinu Malkenu ", 1, 53));
    }

    if (!hebrewDay.isRoshChodesh()
        && !hebrewDay.isCholHamoedPesach()
        && !hebrewDay.isCholHamoedSuccos()) {
      // TODO(low): ideally, add a line break also after Ya'ale v'yavo when it's present.
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 3");
    }

    const isMaybePurim = [
      JewishCalendar.PURIM, JewishCalendar.SHUSHAN_PURIM].includes(hebrewDay.getYomTovIndex());
    if (!hebrewDay.isChanukah() && !isMaybePurim) {
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 6");
    }
    if (!hebrewDay.isChanukah()) {
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 7");
    }
    if (!isMaybePurim) {
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 8");
    }

    return ignored;
  }
}

const renderer = new SiddurRenderer();
window.renderer = renderer;

onceDocumentReady.execute(() => {
  const today = getJewishDate();
  const endpoint = [
    today.getJewishYear(),
    today.getJewishMonth(),
    today.getJewishDayOfMonth(),
    today.getInIsrael(),
  ].join("/");
  new ApiCache().getAndUpdate(`api/WeekdayTorah/${endpoint}`).then(response => {
    renderer.injectTorahPortion(response);
  });
});

new Runner(renderer, driveClient, "siddur").main();
