import {JewishCalendar} from "kosher-zmanim";

export function getHebrewDate(): JewishCalendar {
  const date = new JewishCalendar();
  date.setInIsrael(Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Jerusalem");
  return date;
}

export function isMaybePurim(): boolean {
  return [JewishCalendar.PURIM, JewishCalendar.SHUSHAN_PURIM].includes(
    getHebrewDate().getYomTovIndex());
}

const NO_TACHANUN_DAYS = new Set<number | undefined>([
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
  throw new Error("undefined in NO_TACHANUN_DAYS");
}

export function omitTachanun(): boolean {
  const today = getHebrewDate();
  return today.isRoshChodesh()
    || today.getJewishMonth() === 1
    || (today.getJewishMonth() === 3 && today.getJewishDayOfMonth() <= 12)
    || (today.getJewishMonth() === 7 && today.getJewishDayOfMonth() >= 9)
    || today.isChanukah()
    || (today.getJewishMonth() === JewishCalendar.ADAR && ( // Adar Aleph
      today.getJewishDayOfMonth() === 14 || today.getJewishDayOfMonth() === 15))
    || NO_TACHANUN_DAYS.has(today.getYomTovIndex());
}
