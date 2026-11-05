export interface MasechetDefinition {
  name: string;
  start: number;
  end: number;
}

export interface DateDafPair {
  masechet: string;
  daf: number;
  dateString: string;
}

export interface DeducedDafResult {
  masechet: string;
  daf: number;
  dateString: string;
}

export const MASECHTOT: readonly MasechetDefinition[] = [
  { name: 'Berakhot', start: 2, end: 64 },
  { name: 'Shabbat', start: 2, end: 157 },
  { name: 'Eruvin', start: 2, end: 105 },
  { name: 'Pesachim', start: 2, end: 121 },
  { name: 'Shekalim', start: 2, end: 22 },
  { name: 'Yoma', start: 2, end: 88 },
  { name: 'Sukkah', start: 2, end: 56 },
  { name: 'Beitzah', start: 2, end: 40 },
  { name: 'Rosh Hashanah', start: 2, end: 35 },
  { name: 'Taanit', start: 2, end: 31 },
  { name: 'Megillah', start: 2, end: 32 },
  { name: 'Moed Katan', start: 2, end: 29 },
  { name: 'Chagigah', start: 2, end: 27 },
  { name: 'Yevamot', start: 2, end: 122 },
  { name: 'Ketubot', start: 2, end: 112 },
  { name: 'Nedarim', start: 2, end: 91 },
  { name: 'Nazir', start: 2, end: 66 },
  { name: 'Sotah', start: 2, end: 49 },
  { name: 'Gittin', start: 2, end: 90 },
  { name: 'Kiddushin', start: 2, end: 82 },
  { name: 'Bava Kamma', start: 2, end: 119 },
  { name: 'Bava Metzia', start: 2, end: 119 },
  { name: 'Bava Batra', start: 2, end: 176 },
  { name: 'Sanhedrin', start: 2, end: 113 },
  { name: 'Makkot', start: 2, end: 24 },
  { name: 'Shevuot', start: 2, end: 49 },
  { name: 'Avodah Zarah', start: 2, end: 76 },
  { name: 'Horayot', start: 2, end: 14 },
  { name: 'Zevachim', start: 2, end: 120 },
  { name: 'Menachot', start: 2, end: 110 },
  { name: 'Chullin', start: 2, end: 142 },
  { name: 'Bekhorot', start: 2, end: 61 },
  { name: 'Arakhin', start: 2, end: 34 },
  { name: 'Temurah', start: 2, end: 34 },
  { name: 'Keritot', start: 2, end: 28 },
  { name: 'Meilah', start: 2, end: 22 },
  { name: 'Tamid', start: 25, end: 33 },
  { name: 'Middot', start: 34, end: 37 },
  { name: 'Kinnim', start: 38, end: 39 },
  { name: 'Niddah', start: 2, end: 73 },
];

export const TOTAL_DAYS = 2711;

export const DEFAULT_KNOWN_PAIR: DateDafPair = {
  masechet: 'Bekhorot',
  daf: 48,
  dateString: '2026-11-05',
};

export function masechetMatches(firstMasechetName: string, secondMasechetName: string): boolean {
  if (firstMasechetName.toLowerCase() === secondMasechetName.toLowerCase()) {
    return true;
  }
  const normalizedFirst = firstMasechetName.toLowerCase().replace(/[\s_-]/g, '');
  const normalizedSecond = secondMasechetName.toLowerCase().replace(/[\s_-]/g, '');
  if (normalizedFirst === normalizedSecond) {
    return true;
  }
  if ((normalizedFirst === 'roshhashana' && normalizedSecond === 'roshhashanah')
      || (normalizedFirst === 'roshhashanah' && normalizedSecond === 'roshhashana')) {
    return true;
  }
  return false;
}

export function getDafIndex(masechetName: string, daf: number): number {
  let currentIndex = 0;
  for (const masechet of MASECHTOT) {
    if (masechetMatches(masechet.name, masechetName)) {
      return currentIndex + (daf - masechet.start);
    }
    currentIndex += (masechet.end - masechet.start + 1);
  }
  return -1;
}

export function getDafFromIndex(
  targetIndex: number,
): { masechet: string; daf: number } | undefined {
  let normalizedIndex = ((targetIndex % TOTAL_DAYS) + TOTAL_DAYS) % TOTAL_DAYS;
  for (const masechet of MASECHTOT) {
    const masechetLength = masechet.end - masechet.start + 1;
    if (normalizedIndex < masechetLength) {
      return {
        masechet: masechet.name,
        daf: masechet.start + normalizedIndex,
      };
    }
    normalizedIndex -= masechetLength;
  }
  return undefined;
}

export function getLocalDateString(targetDate: Date = new Date()): string {
  const fullYear = targetDate.getFullYear();
  const monthNumber = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(targetDate.getDate()).padStart(2, '0');
  return `${fullYear}-${monthNumber}-${dayOfMonth}`;
}

export function daysBetween(startDateString: string, endDateString: string): number {
  const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateString.split('-').map(Number);
  const startMilliseconds = Date.UTC(startYear, startMonth - 1, startDay);
  const endMilliseconds = Date.UTC(endYear, endMonth - 1, endDay);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.round((endMilliseconds - startMilliseconds) / millisecondsPerDay);
}

export function deduceTargetDaf(
  lastKnownPair: DateDafPair,
  targetDateString: string,
): DeducedDafResult {
  const anchorIndex = getDafIndex(lastKnownPair.masechet, lastKnownPair.daf);
  if (anchorIndex === -1) {
    return {
      masechet: DEFAULT_KNOWN_PAIR.masechet,
      daf: DEFAULT_KNOWN_PAIR.daf,
      dateString: targetDateString,
    };
  }
  const daysDifference = daysBetween(lastKnownPair.dateString, targetDateString);
  const deduced = getDafFromIndex(anchorIndex + daysDifference);
  if (!deduced) {
    return {
      masechet: lastKnownPair.masechet,
      daf: lastKnownPair.daf,
      dateString: targetDateString,
    };
  }
  return {
    masechet: deduced.masechet,
    daf: deduced.daf,
    dateString: targetDateString,
  };
}
