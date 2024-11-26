import {RealRequestMaker} from "../request_makers";
import {writeJson} from "../util/json_files";

async function main() {
  const requestMaker = new RealRequestMaker();
  const results = await requestMaker.makeRequest(
    "/name/Mishneh Torah?limit=1000&ref_only=1") as any;

  const titles = results.completions.filter((x: any) => x.startsWith("Mishneh Torah,"));

  const output: any[] = [];
  for (const title of titles) {
    // eslint-disable-next-line no-await-in-loop
    const book = await requestMaker.makeRequest("/v2/raw/index/" + title) as any;
    const end = book.schema.lengths[0].toString();
    const primary: any = {};
    const aliases = new Set();
    for (const alias of book.schema.titles) {
      if (alias.primary) {
        primary[alias.lang] = alias.text;
      } else {
        aliases.add(alias.text);
      }
    }

    output.push({
      canonicalName: primary.en,
      hebrewName: primary.he,
      end,
      aliases: Array.from(aliases).sort(),
    });
  }

  writeJson("precomputed/mishneh_torah_books_cached.json", output);
}

main().then(() => {});
