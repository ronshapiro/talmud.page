import {
  calculateGeminiCostUsd,
  runGeminiApi,
  setGenAiClientFactoryForTesting,
} from "./gemini_runner";
import {AgentError, getAgentRunner} from "./agent_runner";
import {extractBase64Images} from "./base64_images";

const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhg"
  + "GAWjR9awAAAABJRU5ErkJggg==";

describe("gemini_runner", () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    setGenAiClientFactoryForTesting(undefined);
  });

  test("getAgentRunner returns runGeminiApi for backend gemini-api", () => {
    expect(getAgentRunner("gemini-api")).toBe(runGeminiApi);
  });

  test("throws AgentError when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(runGeminiApi("Test prompt")).rejects.toThrow(AgentError);
    await expect(runGeminiApi("Test prompt")).rejects.toThrow(/GEMINI_API_KEY/);
  });

  test("throws cancelled AgentError when signal is already aborted", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";
    const controller = new AbortController();
    controller.abort();

    try {
      await runGeminiApi("Test prompt", {signal: controller.signal});
      fail("Expected runGeminiApi to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AgentError);
      expect((error as AgentError).isCancelled).toBe(true);
    }
  });

  test("executes generateContent with thinking set to medium and application/json format", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";

    let capturedParameters: any;
    setGenAiClientFactoryForTesting(() => ({
      models: {
        generateContent: async (parameters: unknown) => {
          capturedParameters = parameters;
          return {
            text: '{"english": "translated text"}',
            usageMetadata: {
              promptTokenCount: 1200,
              cachedContentTokenCount: 1000,
              candidatesTokenCount: 50,
              thoughtsTokenCount: 150,
              totalTokenCount: 1400,
            },
          };
        },
      },
    }));

    const result = await runGeminiApi("Translate this comment", {
      model: "gemini-3.8-flash",
    });

    expect(result.text).toBe('{"english": "translated text"}');
    expect(result.model).toBe("gemini-3.8-flash");
    expect(result.toolUses).toEqual([]);
    expect(result.totalTokens).toBe(1400);

    expect(capturedParameters.model).toBe("gemini-3.8-flash");
    expect(capturedParameters.config.responseMimeType).toBe("application/json");
    expect(capturedParameters.config.thinkingConfig.thinkingLevel).toBe("MEDIUM");
    expect(capturedParameters.contents).toEqual([
      {
        role: "user",
        parts: [{text: "Translate this comment"}],
      },
    ]);
  });

  test("attaches inlineData parts when images are provided", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";

    let capturedParameters: any;
    setGenAiClientFactoryForTesting(() => ({
      models: {
        generateContent: async (parameters: unknown) => {
          capturedParameters = parameters;
          return {
            text: '{"english": "translated"}',
            usageMetadata: {
              promptTokenCount: 500,
              candidatesTokenCount: 20,
            },
          };
        },
      },
    }));

    const {images} = extractBase64Images(`<img src="data:image/png;base64,${sampleBase64}">`);
    await runGeminiApi("Translate with image", {images});

    expect(capturedParameters.contents[0].parts).toEqual([
      {text: "Translate with image"},
      {
        inlineData: {
          mimeType: "image/png",
          data: sampleBase64,
        },
      },
    ]);
  });

  test("calculates Gemini cost accurately with automatic prefix caching", () => {
    // 100k cached tokens ($0.075/1M), 20k uncached ($0.75/1M), 1k output ($3.75/1M)
    const cost = calculateGeminiCostUsd("gemini-3.8-flash", {
      promptTokenCount: 120000,
      cachedContentTokenCount: 100000,
      candidatesTokenCount: 400,
      thoughtsTokenCount: 600,
      totalTokenCount: 121000,
    });

    const expectedUncachedCost = (20000 * 0.75) / 1000000; // 0.015
    const expectedCachedCost = (100000 * 0.075) / 1000000; // 0.0075
    const expectedOutputCost = (1000 * 3.75) / 1000000; // 0.00375
    const expectedTotal = expectedUncachedCost + expectedCachedCost + expectedOutputCost;

    expect(cost).toBeCloseTo(expectedTotal, 6);
  });

  test("maps 429 quota exhaustion to isRateLimited error", async () => {
    process.env.GEMINI_API_KEY = "test-api-key";

    setGenAiClientFactoryForTesting(() => ({
      models: {
        generateContent: async () => {
          const quotaError = new Error("Resource has been exhausted (e.g. check quota).");
          (quotaError as any).status = 429;
          throw quotaError;
        },
      },
    }));

    try {
      await runGeminiApi("Translate prompt");
      fail("Expected runGeminiApi to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AgentError);
      expect((error as AgentError).isRateLimited).toBe(true);
      expect((error as AgentError).backend).toBe("gemini-api");
    }
  });
});
