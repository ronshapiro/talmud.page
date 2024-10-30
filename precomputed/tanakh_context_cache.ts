import {readUtf8} from "../files";

let LLM_RESULTS: Record<string, any> = {};

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
  if (!("Genesis 1:1" in LLM_RESULTS)) {
    LLM_RESULTS = JSON.parse(readUtf8("precomputed/tanakh_contexts_gemini_1.5_flash.json"));
  }

  return LLM_RESULTS[ref];
}
