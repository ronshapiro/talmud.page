import {RealRequestMaker} from "../request_makers";
import {writeJson} from "../util/json_files";

async function run(name: string): Promise<any> {
  const requestMaker = new RealRequestMaker();
  const results = await requestMaker.makeRequest(
    `/name/${name}?limit=1000&ref_only=1`) as any;

  const titles = results.completions.filter((x: any) => x.startsWith(`${name}, `));
  if (titles.length === 0) throw new Error(`No titles for ${name}`);

  const output: any[] = [];
  for (const title of titles) {
    // eslint-disable-next-line no-await-in-loop
    const book = await requestMaker.makeRequest("/v2/raw/index/" + title) as any;

    // require exact match, i.e. for Shulchan Arukh, Even HaEzer, Seder Halitzah
    if (title !== book.title) {
      console.log("No match for", title);
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

    const endOrSections = (() => {
      if (book.schema.lengths) return book.schema.lengths[0].toString();
      if (name === "Peninei Halakhah") {
        const sections = [];
        const queue = [...book.alt_structs.Topic.nodes];
        while (queue.length > 0) {
          const current = queue.shift();
          const ref = current.wholeRef;
          if (ref) {
            for (const prefix of [title, ...aliases]) {
              const candidate = ref.replace(new RegExp(`${prefix},? `), "");
              if (candidate.length < ref.length) {
                sections.push(candidate);
                break;
              }
            }
          }
          if (current.nodes) queue.push(...current.nodes);
        }
        return sections;
      }
      if (book.alt_structs) {
        return book.alt_structs.Topic.nodes.at(-1)!.wholeRef.split(/[ -]/).at(-1);
      }
      return undefined;
    })();
    if (!endOrSections) {
      console.log("No length for", title);
      continue;
    }

    output.push({
      canonicalName: primary.en,
      hebrewName: primary.he,
      end: Array.isArray(endOrSections) ? undefined : endOrSections,
      sections: Array.isArray(endOrSections) ? endOrSections : undefined,
      aliases: Array.from(aliases).sort(),
    });
  }

  writeJson(`precomputed/${name.toLowerCase().replace(/ /g, "_")}_books_cached.json`, output);
}

async function main() {
  return Promise.all([
    // run("Mishneh Torah"),
    // run("Shulchan Arukh"),
    run("Peninei Halakhah"),
  ]);
}

main();
