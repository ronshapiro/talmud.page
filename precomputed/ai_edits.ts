import * as fs from "fs";
import {readUtf8} from "../files";
import {writeJson} from "../util/json_files";

export interface Edit {
  hebrew?: string;
  english?: string;
}
export const OUTPUT_DIR = "precomputed/ai_additions";

export function aiEditsForPage(page: string): Record<string, Edit> | undefined {
  const fileName = `${OUTPUT_DIR}/${page}.json`;
  if (!fs.existsSync(fileName)) return undefined;
  return JSON.parse(readUtf8(fileName)) as Record<string, Edit>;
}

/** Read-modify-write a single ref's edit, preserving the rest of the page's edits. */
export function writeAiEdit(page: string, ref: string, edit: Edit): void {
  const edits = aiEditsForPage(page) ?? {};
  edits[ref] = edit;
  writeJson(`${OUTPUT_DIR}/${page}.json`, edits);
}
