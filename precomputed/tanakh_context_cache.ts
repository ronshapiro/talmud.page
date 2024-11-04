import {readUtf8} from "../files";

let GEMINI_RESULTS: Record<string, any> = {};
let GPT_RESULTS: Record<string, any> = {};

interface SurroundingContext {
  english: string;
  hebrew: string;
}

interface LlmGeneratedTopic {
  english: string;
  hebrew: string;
  surroundingContext: SurroundingContext;
}

export function llmGeneratedTopic(ref: string): LlmGeneratedTopic {
  if (!("Genesis 1:1" in GEMINI_RESULTS)) {
    GEMINI_RESULTS = JSON.parse(readUtf8("precomputed/tanakh_contexts_gemini-1.5-flash.json"));
  }

  const geminiResult = GEMINI_RESULTS[ref];
  if (typeof geminiResult !== "string") return geminiResult;

  if (!("Genesis 1:1" in GPT_RESULTS)) {
    GPT_RESULTS = JSON.parse(readUtf8("precomputed/tanakh_contexts_gpt-4o-mini.json"));
  }
  return GPT_RESULTS[ref];
}
