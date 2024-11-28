import {RealRequestMaker} from "../request_makers";
import {writeJson} from "../util/json_files";

async function run(name: string): Promise<any> {
  const requestMaker = new RealRequestMaker();
  const results = await requestMaker.makeRequest(
    `/name/${name}?limit=1000&ref_only=1`) as any;

  const titles = results.completions.filter((x: any) => x.startsWith(`${name},`));

  const output: any[] = [];
  for (const title of titles) {
    // eslint-disable-next-line no-await-in-loop
    const book = await requestMaker.makeRequest("/v2/raw/index/" + title) as any;
    // require exact match, i.e. for Shulchan Arukh, Even HaEzer, Seder Halitzah
    if (title !== book.title) {
      console.log("No match for", title);
      continue;
    }
    const end = (() => {
      if (book.schema.lengths) return book.schema.lengths[0].toString();
      if (book.alt_structs) {
        return book.alt_structs.Topic.nodes.at(-1)!.wholeRef.split(/[ -]/).at(-1);
      }
      return undefined;
    })();
    if (!end) {
      console.log("No length for", title);
      continue;
    }
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

  writeJson(`precomputed/${name.toLowerCase().replace(/ /g, "_")}_books_cached.json`, output);
}

async function main() {
  return Promise.all([
    run("Mishneh Torah"),
    run("Shulchan Arukh"),
  ]);
}

main();
