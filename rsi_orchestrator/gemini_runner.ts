import {AgentError, AgentOptions, AgentResult, AgentRunner, isCancelledError} from "./agent_runner";

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export function calculateGeminiCostUsd(
  model: string,
  usage?: GeminiUsageMetadata,
): number | undefined {
  if (!usage) return undefined;
  const cachedInputTokens = usage.cachedContentTokenCount ?? 0;
  const uncachedInputTokens = Math.max(0, (usage.promptTokenCount ?? 0) - cachedInputTokens);
  const outputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);

  // Introductory pricing for gemini-3.8-flash (Standard Paid Tier through Dec 31, 2026)
  const uncachedInputRatePerMillion = 0.75;
  const cachedInputRatePerMillion = 0.075;
  const outputRatePerMillion = 3.75;

  return (
    (uncachedInputTokens * uncachedInputRatePerMillion) / 1_000_000
    + (cachedInputTokens * cachedInputRatePerMillion) / 1_000_000
    + (outputTokens * outputRatePerMillion) / 1_000_000
  );
}

export interface GoogleGenAiClient {
  models: {
    generateContent: (parameters: unknown) => Promise<{
      text?: string;
      usageMetadata?: GeminiUsageMetadata;
    }>;
  };
}

export type GenAiClientFactory = (apiKey: string) => GoogleGenAiClient;

let genAiClientFactory: GenAiClientFactory | undefined;

export function setGenAiClientFactoryForTesting(factory?: GenAiClientFactory): void {
  genAiClientFactory = factory;
}

function getDefaultClient(apiKey: string): GoogleGenAiClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const {GoogleGenAI} = require("@google/genai");
  return new GoogleGenAI({apiKey});
}

export const runGeminiApi: AgentRunner = async (
  prompt: string,
  options: AgentOptions = {},
): Promise<AgentResult> => {
  if (options.signal?.aborted) {
    throw new AgentError("Agent execution was cancelled", undefined, "gemini-api", true);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AgentError(
      "GEMINI_API_KEY environment variable is required for the gemini-api backend",
      undefined,
      "gemini-api",
    );
  }

  const model = options.model ?? "gemini-3.8-flash";
  if (options.debug) {
    console.log(`  [agent] Running gemini-api (model: ${model})...`);
  }

  const contentParts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }> = [{text: prompt}];

  if (options.images && options.images.length > 0) {
    for (const image of options.images) {
      contentParts.push({
        inlineData: {
          mimeType: image.mediaType ?? "image/png",
          data: image.base64Data,
        },
      });
    }
  }

  const client = genAiClientFactory ? genAiClientFactory(apiKey) : getDefaultClient(apiKey);
  const startTimeMilliseconds = Date.now();

  let response: {
    text?: string;
    usageMetadata?: GeminiUsageMetadata;
  };

  try {
    response = await client.models.generateContent({
      model,
      contents: [{role: "user", parts: contentParts}],
      config: {
        thinkingConfig: {
          thinkingLevel: "MEDIUM",
        },
        responseMimeType: "application/json",
        abortSignal: options.signal,
      },
    });
  } catch (error: unknown) {
    if (options.signal?.aborted || isCancelledError(error)) {
      throw new AgentError("Agent execution was cancelled", undefined, "gemini-api", true);
    }
    const statusNumber = (error as {status?: number; statusCode?: number})?.status
      ?? (error as {status?: number; statusCode?: number})?.statusCode;
    const errorMessage = (error as Error)?.message ?? String(error);
    throw new AgentError(errorMessage, statusNumber, "gemini-api");
  }

  const durationSeconds = (Date.now() - startTimeMilliseconds) / 1000;
  const usage = response.usageMetadata;
  const costUsd = calculateGeminiCostUsd(model, usage);
  const totalTokens = usage?.totalTokenCount;

  return {
    text: response.text ?? "",
    model,
    costUsd,
    toolUses: [],
    durationSeconds,
    totalTokens,
  };
};
