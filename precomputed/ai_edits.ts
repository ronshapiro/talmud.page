import * as fs from "fs";
import {readUtf8} from "../files";

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
