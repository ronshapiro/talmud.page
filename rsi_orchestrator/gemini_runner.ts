import {
  fetchWikipedia,
  getCommentRefs,
  getNeighborSegments,
  getPriorSugyaSkeleton,
  getRefs,
  searchPage,
} from "./context_fetch";
import {
  AgentError,
  AgentOptions,
  AgentResult,
  AgentRunner,
  isCancelledError,
  ToolUseRecord,
} from "./agent_runner";

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
      candidates?: Array<{
        content?: {
          parts?: Array<unknown>;
        };
      }>;
      functionCalls?: Array<{
        name: string;
        id?: string;
        args?: Record<string, unknown>;
      }>;
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

export const CONTEXT_FETCH_TOOL_DECLARATIONS = [
  {
    name: "get_refs",
    description: "Fetch specific refs' Hebrew/English text. "
      + "Comment refs are the segment ref plus :N (e.g. 'Rashi on Zevachim 2a:1:1').",
    parameters: {
      type: "OBJECT",
      properties: {
        refs: {
          type: "ARRAY",
          items: {type: "STRING"},
          description: "Array of ref strings to fetch",
        },
        lang: {
          type: "STRING",
          enum: ["he", "en", "both"],
          description: "Language to return: 'he', 'en', or 'both' (default: 'both')",
        },
        on: {
          type: "STRING",
          description: "Optional segment ref whose comments to look the refs up in",
        },
      },
      required: ["refs"],
    },
  },
  {
    name: "get_comment_refs",
    description: "List the refs of comments attached to a segment (or on a comment), "
      + "grouped by commentary (e.g. Verses, Mishnah, Tosefta, Jastrow, Rashi, Tosafot).",
    parameters: {
      type: "OBJECT",
      properties: {
        ref: {
          type: "STRING",
          description: "The segment or comment ref, e.g. 'Zevachim 2a:1'",
        },
        commentary: {
          type: "STRING",
          description: "Optional commentary filter, e.g. 'Verses' or 'Rashi'",
        },
      },
      required: ["ref"],
    },
  },
  {
    name: "get_neighbors",
    description: "Fetch the Gemara segments immediately before/after a given segment ref, "
      + "crossing into adjacent amudim automatically.",
    parameters: {
      type: "OBJECT",
      properties: {
        ref: {
          type: "STRING",
          description: "The segment ref to get neighbors for, e.g. 'Zevachim 2a:1'",
        },
        before: {
          type: "INTEGER",
          description: "Number of segments to include before ref (default: 1)",
        },
        after: {
          type: "INTEGER",
          description: "Number of segments to include after ref (default: 1)",
        },
      },
      required: ["ref"],
    },
  },
  {
    name: "get_prior_sugyot",
    description: "Fetch ref-range metadata (not full text) for sugyot immediately preceding the "
      + "current page.",
    parameters: {
      type: "OBJECT",
      properties: {
        ref: {
          type: "STRING",
          description: "The segment or page ref",
        },
        count: {
          type: "INTEGER",
          description: "Number of prior sugyot to return (default: 2)",
        },
      },
      required: ["ref"],
    },
  },
  {
    name: "search_page",
    description: "Find a word or phrase in one page or segment range across Gemara and "
      + "commentaries, ignoring Hebrew vowels and punctuation.",
    parameters: {
      type: "OBJECT",
      properties: {
        page: {
          type: "STRING",
          description: "Page or segment range, e.g. 'Sukkah 53b' or 'Sukkah 53b:7-54a:2'",
        },
        query: {
          type: "STRING",
          description: "Word or phrase to search for",
        },
        commentary: {
          type: "ARRAY",
          items: {type: "STRING"},
          description: "Commentaries to search in addition to Gemara (e.g. ['Rashi', 'Tosafot'])",
        },
      },
      required: ["page", "query"],
    },
  },
  {
    name: "wikipedia",
    description: "Fetch summary text from Wikipedia for a term (useful for realia, botanical/zoological "
      + "terms, historical figures, or French loanwords).",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Article title or search term",
        },
        lang: {
          type: "STRING",
          description: "Language code, e.g. 'en' or 'he' (default 'en')",
        },
      },
      required: ["query"],
    },
  },
];

export async function executeContextTool(
  name: string,
  parameters: Record<string, unknown>,
): Promise<{result?: unknown; error?: string; commandLine: string}> {
  const normalizedName = name.replace(/-/g, "_");
  switch (normalizedName) {
    case "get_refs": {
      const refs = (parameters.refs as string[]) ?? [];
      const lang = parameters.lang as "he" | "en" | "both" | undefined;
      const on = parameters.on as string | undefined;
      const commandLine = "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs "
        + `'${JSON.stringify(refs)}'${lang ? ` --lang ${lang}` : ""}`
        + `${on ? ` --on "${on}"` : ""}`;
      try {
        return {result: getRefs(refs, lang, on), commandLine};
      } catch (error: unknown) {
        return {error: (error as Error).message, commandLine};
      }
    }
    case "get_comment_refs": {
      const ref = String(parameters.ref ?? "");
      const commentary = parameters.commentary as string | undefined;
      const commandLine = "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-comment-refs "
        + `"${ref}"${commentary ? ` --commentary "${commentary}"` : ""}`;
      try {
        return {result: getCommentRefs(ref, commentary), commandLine};
      } catch (error: unknown) {
        return {error: (error as Error).message, commandLine};
      }
    }
    case "get_neighbors": {
      const ref = String(parameters.ref ?? "");
      const before = typeof parameters.before === "number" ? parameters.before : 1;
      const after = typeof parameters.after === "number" ? parameters.after : 1;
      const commandLine = "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-neighbors "
        + `"${ref}" --before ${before} --after ${after}`;
      try {
        return {result: getNeighborSegments(ref, before, after), commandLine};
      } catch (error: unknown) {
        return {error: (error as Error).message, commandLine};
      }
    }
    case "get_prior_sugyot": {
      const ref = String(parameters.ref ?? "");
      const count = typeof parameters.count === "number" ? parameters.count : 2;
      const commandLine = "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-prior-sugyot "
        + `"${ref}" --count ${count}`;
      try {
        return {result: getPriorSugyaSkeleton(ref, count), commandLine};
      } catch (error: unknown) {
        return {error: (error as Error).message, commandLine};
      }
    }
    case "search":
    case "search_page": {
      const page = String(parameters.page ?? "");
      const query = String(parameters.query ?? "");
      const commentary = parameters.commentary as string[] | undefined;
      const commentaryArg = commentary && commentary.length > 0
        ? ` --commentary ${commentary.join(" ")}`
        : "";
      const commandLine = "npx ts-node rsi_orchestrator/context_fetch_cli.ts search "
        + `"${page}" "${query}"${commentaryArg}`;
      try {
        return {result: searchPage(page, query, commentary), commandLine};
      } catch (error: unknown) {
        return {error: (error as Error).message, commandLine};
      }
    }
    case "wikipedia": {
      const query = String(parameters.query ?? "");
      const lang = (parameters.lang as string | undefined) ?? "en";
      const commandLine = "npx ts-node rsi_orchestrator/context_fetch_cli.ts wikipedia "
        + `"${query}" --lang ${lang}`;
      try {
        const result = await fetchWikipedia(query, lang);
        return {result, commandLine};
      } catch (error: unknown) {
        return {error: (error as Error).message, commandLine};
      }
    }
    default:
      return {
        error: `Unknown tool: ${name}`,
        commandLine: `npx ts-node rsi_orchestrator/context_fetch_cli.ts ${name}`,
      };
  }
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
    // eslint-disable-next-line no-console
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

  const conversationContents: Array<unknown> = [
    {role: "user", parts: contentParts},
  ];

  const toolUses: ToolUseRecord[] = [];
  const maximumToolTurns = 10;
  let totalCostUsd = 0;
  let totalTokensAccumulated = 0;
  let finalResponseText = "";
  let currentTurnIndex = 0;

  const enableTools = options.allowedTools === undefined || options.allowedTools.length > 0;
  const toolsConfig = enableTools
    ? [{functionDeclarations: CONTEXT_FETCH_TOOL_DECLARATIONS}]
    : undefined;

  while (currentTurnIndex < maximumToolTurns) {
    currentTurnIndex += 1;
    if (options.signal?.aborted) {
      throw new AgentError("Agent execution was cancelled", undefined, "gemini-api", true);
    }

    let response: {
      text?: string;
      candidates?: Array<{
        content?: {
          parts?: Array<unknown>;
        };
      }>;
      functionCalls?: Array<{
        name: string;
        id?: string;
        args?: Record<string, unknown>;
      }>;
      usageMetadata?: GeminiUsageMetadata;
    };

    try {
      // eslint-disable-next-line no-await-in-loop
      response = await client.models.generateContent({
        model,
        contents: conversationContents,
        config: {
          ...(toolsConfig ? {tools: toolsConfig} : {}),
          thinkingConfig: {
            thinkingLevel: "MEDIUM",
          },
          responseMimeType: "application/json",
          ...(options.responseSchema ? {responseSchema: options.responseSchema} : {}),
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

    const usage = response.usageMetadata;
    const turnCost = calculateGeminiCostUsd(model, usage);
    if (turnCost !== undefined) {
      totalCostUsd += turnCost;
    }
    if (usage?.totalTokenCount) {
      totalTokensAccumulated = usage.totalTokenCount;
    }

    const {functionCalls} = response;
    if (!functionCalls || functionCalls.length === 0) {
      finalResponseText = response.text ?? "";
      break;
    }

    const toolResponseParts: Array<unknown> = [];
    const modelParts = response.candidates?.[0]?.content?.parts ?? [];

    for (const call of functionCalls) {
      const callArgs = call.args ?? {};
      // eslint-disable-next-line no-await-in-loop
      const executed = await executeContextTool(call.name, callArgs);

      const toolRecord: ToolUseRecord = {
        name: "run_command",
        input: {
          command: executed.commandLine,
          CommandLine: executed.commandLine,
        },
      };
      toolUses.push(toolRecord);
      if (options.onToolUse) {
        options.onToolUse(toolRecord);
      }

      toolResponseParts.push({
        functionResponse: {
          name: call.name,
          id: call.id,
          response: {
            output: executed.result ?? {error: executed.error},
          },
        },
      });
    }

    conversationContents.push({
      role: "model",
      parts: modelParts,
    });
    conversationContents.push({
      role: "user",
      parts: toolResponseParts,
    });
  }

  const durationSeconds = (Date.now() - startTimeMilliseconds) / 1000;

  return {
    text: finalResponseText,
    model,
    costUsd: totalCostUsd > 0 ? totalCostUsd : undefined,
    toolUses,
    durationSeconds,
    totalTokens: totalTokensAccumulated > 0 ? totalTokensAccumulated : undefined,
  };
};
