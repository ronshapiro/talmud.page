import * as fs from "fs";
import {readUtf8} from "../files";
import {writeJson} from "../util/json_files";

import {splitOnBookName} from "../refs";

export interface Edit {
  hebrew?: string;
  english?: string;
  // Set by the RSI orchestrator on newly generated candidates; absent (the default for every
  // pre-existing shipped edit) means live. Replaced by `approved` on approve.
  status?: "pending";
  // The username of the reviewer who approved this edit. Replaces `status: "pending"` on approve.
  approved?: string;
  model?: string;
}

export const OUTPUT_DIR = "precomputed/ai_additions";

export function aiEditsPath(page: string): string {
  if (!page.includes(" ")) {
    return `${OUTPUT_DIR}/${page}.json`;
  }
  const [book, pageName] = splitOnBookName(page);
  return `${OUTPUT_DIR}/${book}/${pageName}.json`;
}

export function aiEditsForPage(page: string): Record<string, Edit> | undefined {
  const fileName = aiEditsPath(page);
  if (!fs.existsSync(fileName)) return undefined;
  return JSON.parse(readUtf8(fileName)) as Record<string, Edit>;
}

/** Read-modify-write a single ref's edit, preserving the rest of the page's edits. */
export function writeAiEdit(page: string, ref: string, edit: Edit): void {
  const edits = aiEditsForPage(page) ?? {};
  edits[ref] = edit;
  const fileName = aiEditsPath(page);
  const directory = fileName.slice(0, fileName.lastIndexOf("/"));
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {recursive: true});
  }
  writeJson(fileName, edits);
}
