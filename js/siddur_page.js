import * as _ from "underscore";
import {JewishCalendar, ZmanimCalendar} from "kosher-zmanim";
import {ApiCache} from "./ApiCache.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {LiturgyRenderer} from "./liturgy_renderer.js";
import {onceDocumentReady} from "./once_document_ready.ts";
import {Runner} from "./page_runner.js";
import {getHebrewDate as getJewishDate, isMaybePurim, omitTachanun} from "./hebrew_calendar";
import {ASERET_YIMEI_TESHUVA_REFS} from "./aseret_yimei_teshuva.ts";

const IS_NATIONAL_TRAGEDY = true;
const INJECT_WEEKDAY_TORAH_PORTION_AFTER_REF = (
  "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Birkat Hatorah 6");

function refRanges(prefix, startIndex, endIndex) {
  return _.range(startIndex, endIndex + 1).map(x => prefix + x);
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

class SiddurRenderer extends LiturgyRenderer {
  sortedAmudim() {
    let keys = Object.keys(this.allAmudim);

    if ("Torah" in this.allAmudim && this.injectedTorahPortions) {
      const torahSection = this.allAmudim.Torah;
      const splitPoint = torahSection.sections.findIndex(
        section => section.ref === INJECT_WEEKDAY_TORAH_PORTION_AFTER_REF) + 1;
      if (splitPoint !== 0) {
        let newSections = torahSection.sections.slice(0, splitPoint);
        for (let i = 0; i < this.injectedTorahPortions.length; i++) {
          const aliya = this.injectedTorahPortions[i];
          const hebrewIndex = ["א", "ב", "ג", "ד"][i];
          const title = (
            getJewishDate().isTaanis() && i === 3
              ? "הפטרה"
              : `עליה ${hebrewIndex}'`);
          newSections.push({
            commentary: {},
            he: `<strong>${title}</strong>`,
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
    if (!this.hasTorahPortions) {
      keys = _.without(keys, "Torah", "Yehalelu");
    }

    if (omitTachanun()) {
      keys = _.without(keys, "Tachanun");
    }

    const today = getJewishDate();
    if (today.getYomTovIndex() === JewishCalendar.EREV_PESACH || today.isCholHamoedPesach()) {
      keys = _.without(keys, "Mizmor Letoda");
    }

    return keys.map(key => this.allAmudim[key]);
  }

  injectTorahPortion(portionRespones) {
    if (portionRespones.length > 0) {
      this.injectedTorahPortions = portionRespones;
      this.hasTorahPortions = true;
      this.forceUpdate();
    }
  }

  ignoredSectionRefs(pageId) {
    const day = new Date().getDay();
    const ignored = [];
    const shirShelYomPrefix = "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Song of the Day ";
    console.log(pageId, day);
    if (pageId === "Conclusion" || pageId === "Aleinu") {
      if (day !== 0) {
        ignored.push(shirShelYomPrefix + 3);
        ignored.push(...refRanges("Psalms 24:", 1, 10));
      }
      if (day !== 1) {
        ignored.push(shirShelYomPrefix + 6);
        ignored.push(...refRanges("Psalms 48:", 1, 15));
      }
      if (day !== 2) {
        ignored.push(shirShelYomPrefix + 9);
        ignored.push(...refRanges("Psalms 82:", 1, 8));
      }
      if (day !== 3) {
        ignored.push(shirShelYomPrefix + 12);
        ignored.push(...refRanges("Psalms 94:", 1, 23, true));
        ignored.push(...refRanges("Psalms 95:", 1, 3));
      }
      if (day !== 4) {
        ignored.push(shirShelYomPrefix + 15);
        ignored.push(...refRanges("Psalms 81:", 1, 17));
      }
      if (day !== 5) {
        ignored.push(shirShelYomPrefix + 18);
        ignored.push(...refRanges("Psalms 93:", 1, 5));
      }
    }
    if (day !== 1 && day !== 4) {
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, For Monday and Thursday ",
        1, 8));
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Tachanun, God of Israel ", 1, 11));
      ignored.push(...refRanges(
        "Siddur Sefard, Weekday Shacharit, For Monday & Thursday ", 3, 9));
    }
    if (omitTachanun()) {
      ignored.push(
        ...refRanges(
          "Siddur Ashkenaz, Weekday, Shacharit, Torah Reading, Reading from Sefer, Raising the Torah ", 5, 9),
        "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Akedah 3",
        "Siddur Sefard, Weekday Shacharit, Morning Prayer 3",
        "Siddur Sefard, Weekday Shacharit, Morning Prayer 4",
      );
    }

    const hebrewDay = getJewishDate();
    if (!hebrewDay.isRoshChodesh()) {
      ignored.push(...refRanges(
        "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, Barchi Nafshi ", 1, 8));
    }

    if (!hebrewDay.getJewishMonth() !== 6
        && !(hebrewDay.getJewishMonth() === 7 && hebrewDay.getJewishDayOfMonth() <= 22)) {
      ignored.push(
        "Siddur Ashkenaz, Weekday, Shacharit, Concluding Prayers, LeDavid 1",
        ...refRanges("Psalms 27:", 1, 14));
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
        "Siddur Sefard, Weekday Shacharit, Amidah 66",
      ]);
    } else {
      ignored.push(...Array.from(ASERET_YIMEI_TESHUVA_REFS));
    }

    if (!hebrewDay.isTaanis()) {
      ignored.push("tp::Annenu");
    }

    // Always prefer Aseret Yimei Teshuva, because if it's Tzom Gedalia, Aseret Yimei Teshuva
    // version is still said
    const AVINU_MALKENU_PREFIX = "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Avinu Malkenu ";
    if (hebrewDay.isAseresYemeiTeshuva()) {
      ignored.push(...refRanges(AVINU_MALKENU_PREFIX, 28, 33));
      ignored.push(AVINU_MALKENU_PREFIX + 6);
    } else if (hebrewDay.isTaanis() || IS_NATIONAL_TRAGEDY) {
      ignored.push(...refRanges(AVINU_MALKENU_PREFIX, 22, 27));
      ignored.push(AVINU_MALKENU_PREFIX + 5);
    } else {
      ignored.push(...refRanges(
        AVINU_MALKENU_PREFIX, 1, 53));
    }


    if (!hebrewDay.isRoshChodesh()
        && !hebrewDay.isCholHamoedPesach()
        && !hebrewDay.isCholHamoedSuccos()) {
      // TODO(low): ideally, add a line break also after Ya'ale v'yavo when it's present.
      ignored.push("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Temple Service 3");
    }

    if (!hebrewDay.isChanukah() && !isMaybePurim()) {
      ignored.push(
        "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 6",
        "Siddur Sefard, Weekday Shacharit, Amidah 98");
    }
    if (!hebrewDay.isChanukah()) {
      ignored.push(
        "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 7",
        "Siddur Sefard, Weekday Shacharit, Amidah 100");
    }
    if (!isMaybePurim()) {
      ignored.push(
        "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 8",
        "Siddur Sefard, Weekday Shacharit, Amidah 102");
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
    renderer.injectTorahPortion(response.aliyot);
  });

  const classToHide = (
    today.isAseresYemeiTeshuva() ? "non-aseret-yimei-teshuva" : "aseret-yimei-teshuva-word");
  const style = document.createElement("style");
  style.type = "text/css";
  style.innerHTML = `.${classToHide} { display: none; }`;
  document.head.append(style);
});

new Runner(renderer, driveClient, "siddur").main();
