import {readAndParseGzippedJsonFile} from "../files";

interface SurroundingContext {
  english: string;
  hebrew: string;
}

export interface LlmGeneratedTopic {
  english: string;
  hebrew: string;
  surroundingContext: SurroundingContext;
}

const files = [
  // Compress with `gzip <path>`
  "tanakh_contexts_gemini-1.5-flash-v2.json.gz",
  "tanakh_contexts_gemini-1.5-flash-v1.json.gz",
  "tanakh_contexts_gpt-4o-mini.json.gz",
];
const parsedFiles: Record<string, any>[] = [];


export function llmGeneratedTopic(ref: string): LlmGeneratedTopic | undefined {
  if (parsedFiles.length === 0) {
    for (const file of files) {
      parsedFiles.push(readAndParseGzippedJsonFile(`precomputed/${file}`));
    }
  }

  for (const file of parsedFiles) {
    const result = file[ref];
    if (result && typeof result === "object") {
      return result;
    }
  }
  return undefined;
}
