import {driveClient} from "./google_drive/singleton.ts";
import {LiturgyRenderer} from "./liturgy_renderer.js";
import {Runner} from "./page_runner.js";
import {getHebrewDate, isMaybePurim, omitTachanun} from "./hebrew_calendar.ts";

class BirkatHamazonRenderer extends LiturgyRenderer {
  sortedAmudim() {
    let keys = Object.keys(this.allAmudim);
    if (!omitTachanun()) {
      keys = keys.filter(key => key !== "Shir_Hama'alot");
    }

    return keys.map(key => this.allAmudim[key]);
  }

  ignoredSectionRefs() {
    const ignored = [];
    const today = getHebrewDate();

    if (!today.isChanukah() && !isMaybePurim()) {
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 25");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 26");
    }
    if (!today.isChanukah()) {
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 28");
    }
    if (!isMaybePurim()) {
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 30");
    }

    if (!today.isRoshChodesh()
        && !today.isCholHamoedPesach()
        && !today.isCholHamoedSuccos()) {
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 37");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 45");
    }
    if (!today.isRoshChodesh()) {
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 38");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 67");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 68");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 77");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 80");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 81");
    }
    if (!today.isCholHamoedPesach()) {
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 39");
    }
    if (!today.isCholHamoedSuccos()) {
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 41");
      ignored.push("Siddur Ashkenaz, Berachot, Birkat HaMazon 74");
    }

    return ignored;
  }
}

new Runner(new BirkatHamazonRenderer(), driveClient, "siddur").main();
