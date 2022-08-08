/* eslint-disable no-console, no-await-in-loop */
import {fetch} from "./fetch";
import {writeJson} from "./util/json_files";

interface Data {
  ref: string,
  index: number,
}
type ExportType = Record<string, Data>;

const NUMBER_PREFIX = /^\d+\.?  ?/;

function traverse(
  rootTitle: string,
  title: string | undefined,
  container: any,
  mapping: ExportType,
) {
  for (const node of container.nodes || []) {
    const prefix = node.title.replace(NUMBER_PREFIX, "");
    let newTitle = [title || rootTitle, prefix].join(", ");
    if (newTitle in mapping
      && node.wholeRef === "Peninei Halakhah, Simchat Habayit V'Birchato 4:15") {
      newTitle = "Peninei Halakhah, Simchat Habayit U'Virkhato, Safeguarding the Covenant of Circumcision, The Mitzva of the Wedding";
    }
    newTitle = newTitle.replace(/^Peninei Halakhah, /, "").replace(/"/g, "");
    if (node.wholeRef) {
      if (newTitle in mapping) {
        console.error(mapping[newTitle]);
        throw new Error(`!!!!!!! ${newTitle} @@ ${node.wholeRef}`);
      }
      mapping[newTitle] = {ref: node.wholeRef, index: Object.keys(mapping).length};
    }

    traverse(rootTitle, newTitle, node, mapping);
  }
}

async function process(x: any, mapping: ExportType) {
  for (const next of x.contents || []) {
    await process(next, mapping);
  }
  if (x.title && x.title.startsWith("Peninei Halakhah")) {
    const subindex = await fetch(`https://www.sefaria.org/api/index/${x.title}`);
    const json = await subindex.json();
    traverse(x.title, undefined, json.alts.Topic, mapping);
  }
}

async function main() {
  const index = await fetch('https://www.sefaria.org/api/index');
  const json = await index.json();
  const mapping: ExportType = {};
  for (const x of json) {
    await process(x, mapping);
  }
  writeJson("peninei_halacha_index.json", mapping);
}

main();
