import {readUtf8} from "../files";
import {stripHebrewNonletters} from "../hebrew";
import {ListMultimap} from "../multimap";

const TOPICS: Record<string, any> = {};

export function topicJson(slug: string): sefaria.Topic {
  if (!("prayer" in TOPICS)) {
    for (const topic of JSON.parse(readUtf8("precomputed/all_topics.json"))) {
      TOPICS[topic.slug] = topic;
    }
  }
  slug = slug.replace("/topics/", "");
  return TOPICS[slug] ?? {
    slug,
    primaryTitle: {
      en: slug,
      he: slug,
    },
    description: {
      en: `No information provided for ${slug}`,
      he: `אין מידע ל- ${slug}`,
    },
    titles: [],
  };
}

type DupeValue = [string, (boolean | number)[]];

function dupeSorter(dupeA: DupeValue, dupeB: DupeValue): number {
  const a = dupeA[1];
  const b = dupeB[1];
  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] === "boolean") {
      if (a[i] && !b[i]) return -1;
      if (!a[i] && b[i]) return 1;
    } else if (typeof a[i] === "number") {
      return (b[i] as number) - (a[i] as number);
    }
  }
  return dupeB[0].length - dupeA[0].length;
}

function dedupe(dupes: ListMultimap<string, DupeValue>) {
  const result = [];
  for (const dupeGroup of Array.from(dupes.asMap().values())) {
    dupeGroup.sort(dupeSorter);
    result.push(dupeGroup[0][0]);
  }
  return result;
}

const DOT_ABOVE = new RegExp("\u{307}", "g");
export function dedupeHebrewRabbiNames(subjects: string[]): string[] {
  const dupes = new ListMultimap<string, DupeValue>();
  for (const subject of subjects) {
    const withoutVowels = stripHebrewNonletters(subject).replace(DOT_ABOVE, "");
    const hasVowels = subject !== withoutVowels;
    const withReducedPrefix = withoutVowels.replace(/^רבי? /, "ר' ").replace(/^ר /, "ר' ");
    const isFullPrefix = withoutVowels !== withReducedPrefix;
    const barToBen = withReducedPrefix.replace(/ בר /g, " בן ");

    dupes.put(barToBen, [subject, [
      hasVowels,
      isFullPrefix,
      barToBen === withReducedPrefix,
      !DOT_ABOVE.test(subject)]]);
  }
  return dedupe(dupes);
}

function uppercaseCount(subject: string): number {
  return Array.from(subject).filter(x => /[A-Z]/.test(x)).length;
}

export function dedupeEnglishRabbiNames(subjects: string[]): string[] {
  const dupes = new ListMultimap<string, DupeValue>();
  for (const subject of subjects) {
    if (subject.includes(" b. ")) continue;
    if (subject.startsWith("#")) continue;
    const lowercase = subject.toLowerCase();
    const withoutHSuffix = lowercase.replace(/h /g, " ").replace(/h$/, "");
    const khToCh = withoutHSuffix.replace(/kh/g, "ch");
    dupes.put(khToCh, [subject, [
      withoutHSuffix === lowercase,
      khToCh === withoutHSuffix,
      -uppercaseCount(subject),
    ]]);
  }
  return dedupe(dupes);
}
