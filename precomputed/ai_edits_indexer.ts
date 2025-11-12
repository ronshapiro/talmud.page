import * as fs from "fs";
import {readUtf8, writeUtf8} from "../files";
import {jsonStringify} from "../util/json_stringify";
import {Edit, OUTPUT_DIR} from "./ai_edits";

const SUGYA_REWRITING_INPUT_DIR = "precomputed/sugya_rewriting_temp/v1-flash";
const outputsByAmud: Record<string, Record<string, Edit>> = {};
for (const name of fs.readdirSync(SUGYA_REWRITING_INPUT_DIR)) {
  const response = JSON.parse(readUtf8(`${SUGYA_REWRITING_INPUT_DIR}/${name}`));
  for (const amud of response.amudim) {
    if (!outputsByAmud[amud]) {
      outputsByAmud[amud] = {};
    }
    const amudOutput = outputsByAmud[amud];

    for (const edit of response.edits) {
      if (!amudOutput[edit.ref]) amudOutput[edit.ref] = {} as Edit;
      // TODO: check that these don't clash!
      if (edit.hebrew) amudOutput[edit.ref].hebrew = edit.hebrew;
      if (edit.english) amudOutput[edit.ref].english = edit.english;
    }
  }
}


for (const [amud, amudOutput] of Object.entries(outputsByAmud)) {
  writeUtf8(`${OUTPUT_DIR}/${amud}.json`, jsonStringify(amudOutput));
}
