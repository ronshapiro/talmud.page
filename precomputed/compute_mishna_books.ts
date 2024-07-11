/* eslint-disable no-await-in-loop */
import {RealRequestMaker} from "../request_makers";
import {ListMultimap} from "../multimap";

async function getCanonicalAndHebrewName(bookTitle: string): Promise<[string, string]> {
  const res = await new RealRequestMaker().makeRequest(`/v2/raw/index/${bookTitle}`) as any;
  let hebrew = "";
  for (const title of res.schema.titles) {
    if (title.primary && title.lang === "he") {
      hebrew = title.text as string;
    }
  }
  return [res.title as string, hebrew];
}

async function numChapters(title: string): Promise<number> {
  const res = await new RealRequestMaker().makeRequest(`/v2/raw/index/${title}`) as any;
  return res.schema.lengths[0] as number;
}

async function main() {
  const titles: any = await new RealRequestMaker().makeRequest("/index/titles");
  const mishnaTitles = new ListMultimap<string, string>();
  const hebrewNames: Record<string, string> = {};
  for (const title of titles.books as string[]) {
    if (title.startsWith("Mishnah ") && !title.endsWith(".")) {
      const [canonical, hebrew] = await getCanonicalAndHebrewName(title);
      if (canonical === "Mishnah Berurah") continue;
      mishnaTitles.put(canonical, title);
      hebrewNames[canonical] = hebrew;
    }
  }

  for (const [canonical, aliases] of Array.from(mishnaTitles.asMap())) {
    const chapterCount = await numChapters(canonical);
    const aliasesBuilder = ["["];
    for (const alias of aliases) {
      if (alias !== canonical) {
        aliasesBuilder.push(`"${alias}", `);
      }
    }
    aliasesBuilder.push("]");
    // eslint-disable-next-line no-console
    console.log(`new MishnaMasechet({
  canonicalName: ${canonical},
  hebrewName: ${hebrewNames[canonical]},
  aliases: ${aliasesBuilder.join('')},
  numChapters: ${chapterCount},
}),`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MISHNA_MASECHTOT = [
  "Mishnah Arakhin",
  "Mishnah Avodah Zarah",
  "Mishnah Bava Batra",
  "Mishnah Bava Kamma",
  "Mishnah Bava Metzia",
  "Mishnah Beitzah",
  "Mishnah Bekhorot",
  "Mishnah Berakhot",
  "Mishnah Bikkurim",
  "Mishnah Chagigah",
  "Mishnah Challah",
  "Mishnah Chullin",
  "Mishnah Demai",
  "Mishnah Eduyot",
  "Mishnah Eruvin",
  "Mishnah Gittin",
  "Mishnah Horayot",
  "Mishnah Kelim",
  "Mishnah Keritot",
  "Mishnah Ketubot",
  "Mishnah Kiddushin",
  "Mishnah Kilayim",
  "Mishnah Kinnim",
  "Mishnah Maaser Sheni",
  "Mishnah Maasrot",
  "Mishnah Makhshirin",
  "Mishnah Makkot",
  "Mishnah Megillah",
  "Mishnah Meilah",
  "Mishnah Menachot",
  "Mishnah Middot",
  "Mishnah Mikvaot",
  "Mishnah Moed Katan",
  "Mishnah Nazir",
  "Mishnah Nedarim",
  "Mishnah Negaim",
  "Mishnah Niddah",
  "Mishnah Oholot",
  "Mishnah Oktzin",
  "Mishnah Orlah",
  "Mishnah Parah",
  "Mishnah Peah",
  "Mishnah Pesachim",
  "Mishnah Rosh Hashanah",
  "Mishnah Sanhedrin",
  "Mishnah Shabbat",
  "Mishnah Shekalim",
  "Mishnah Sheviit",
  "Mishnah Shevuot",
  "Mishnah Sotah",
  "Mishnah Sukkah",
  "Mishnah Ta'anit",
  "Mishnah Tahorot",
  "Mishnah Tamid",
  "Mishnah Temurah",
  "Mishnah Terumot",
  "Mishnah Tevul Yom",
  "Mishnah Yadayim",
  "Mishnah Yevamot",
  "Mishnah Yoma",
  "Mishnah Zavim",
  "Mishnah Zevachim",
  "Pirkei Avot",
];

main();
