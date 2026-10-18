import * as fs from "fs";
import {writeJson} from "../../util/json_files";
import {getTaskModelConfig, ModelRoutingConfig, readModelRoutingConfig} from "./model_routing";

const CONFIG_PATH = "precomputed/rsi_state/__test_model_routing__.json";

const SAMPLE_CONFIG = {
  agy: {
    default: {
      generateModel: "gemini-3.8-flash-high",
      critiqueModel: "gemini-3.8-flash-medium",
    },
    "sonnet-4.6": {
      generateModel: "claude-sonnet-4-6",
      critiqueModel: "gemini-3.8-flash-medium",
    },
  },
  claude: {
    default: {
      generateModel: "claude-sonnet-5",
      critiqueModel: "claude-sonnet-5",
    },
  },
};

afterEach(() => {
  fs.rmSync(CONFIG_PATH, {force: true});
});

test("readModelRoutingConfig returns an empty object when there's no config file", () => {
  expect(readModelRoutingConfig(CONFIG_PATH)).toEqual({});
});

test("readModelRoutingConfig reads a written config file", () => {
  const config: ModelRoutingConfig = SAMPLE_CONFIG;
  writeJson(CONFIG_PATH, config);
  expect(readModelRoutingConfig(CONFIG_PATH)).toEqual(config);
});

test("getTaskModelConfig throws when the task type isn't configured", () => {
  writeJson(CONFIG_PATH, {other_task: SAMPLE_CONFIG});
  expect(() => getTaskModelConfig("my_task", CONFIG_PATH)).toThrow(/my_task/);
});

test("getTaskModelConfig throws when there's no config file at all", () => {
  expect(() => getTaskModelConfig("my_task", CONFIG_PATH)).toThrow(/my_task/);
});

test("getTaskModelConfig resolves default backend and config when options omitted", () => {
  writeJson(CONFIG_PATH, SAMPLE_CONFIG);
  const resolved = getTaskModelConfig("any_task", CONFIG_PATH);
  expect(resolved).toEqual({
    backend: "agy",
    generateModel: "gemini-3.8-flash-high",
    critiqueModel: "gemini-3.8-flash-medium",
  });
});

test("getTaskModelConfig resolves requested backend with its default config", () => {
  writeJson(CONFIG_PATH, SAMPLE_CONFIG);
  const resolved = getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "claude",
  });
  expect(resolved).toEqual({
    backend: "claude",
    generateModel: "claude-sonnet-5",
    critiqueModel: "claude-sonnet-5",
  });
});

test("getTaskModelConfig returns named config under requested backend", () => {
  writeJson(CONFIG_PATH, SAMPLE_CONFIG);
  const resolved = getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "agy",
    configName: "sonnet-4.6",
  });
  expect(resolved).toEqual({
    backend: "agy",
    generateModel: "claude-sonnet-4-6",
    critiqueModel: "gemini-3.8-flash-medium",
  });
});

test("getTaskModelConfig fuzzy matches hyphens, dots, and prefixes in configName", () => {
  writeJson(CONFIG_PATH, SAMPLE_CONFIG);
  const resolved = getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "agy",
    configName: "claude-sonnet-4-6",
  });
  expect(resolved.generateModel).toBe("claude-sonnet-4-6");
  expect(resolved.critiqueModel).toBe("gemini-3.8-flash-medium");
});

test("getTaskModelConfig infers backend from config name if backend omitted", () => {
  writeJson(CONFIG_PATH, SAMPLE_CONFIG);
  const resolved = getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    configName: "sonnet-4.6",
  });
  expect(resolved.backend).toBe("agy");
  expect(resolved.generateModel).toBe("claude-sonnet-4-6");
});

test("getTaskModelConfig throws descriptive error for unknown configName", () => {
  writeJson(CONFIG_PATH, SAMPLE_CONFIG);
  expect(() => getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "agy",
    configName: "nonexistent",
  })).toThrow(/Unknown model config "nonexistent" for backend "agy"/);
});

test("getTaskModelConfig throws descriptive error for unknown backend", () => {
  writeJson(CONFIG_PATH, SAMPLE_CONFIG);
  expect(() => getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "unknown-backend",
  })).toThrow(/Unknown backend "unknown-backend".*Available backends: agy, claude/);
});


test("getTaskModelConfig checks requested backend with matchesConfig first, falling back to base backend", () => {
  const customConfig = {
    claude: {
      default: {
        generateModel: "claude-sonnet-5",
        critiqueModel: "claude-sonnet-5",
      },
      "custom-preset": {
        generateModel: "claude-base-model",
        critiqueModel: "claude-base-model",
      },
      "override-preset": {
        generateModel: "claude-base-override",
        critiqueModel: "claude-base-override",
      },
    },
    "claude-long-thread": {
      "override-preset": {
        generateModel: "claude-long-thread-special",
        critiqueModel: "claude-long-thread-special",
      },
    },
  };
  writeJson(CONFIG_PATH, customConfig);

  const directMatch = getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "claude-long-thread",
    configName: "override-preset",
  });
  expect(directMatch.generateModel).toBe("claude-long-thread-special");

  const fallbackMatch = getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "claude-long-thread",
    configName: "custom-preset",
  });
  expect(fallbackMatch.generateModel).toBe("claude-base-model");
});

test("getTaskModelConfig preserves critiqueBackend when defined in preset", () => {
  const customConfig = {
    ollama: {
      default: {
        generateModel: "gemma4:31b",
        critiqueModel: "gemini-3.8-flash-medium",
        critiqueBackend: "agy",
      },
    },
  };
  writeJson(CONFIG_PATH, customConfig);

  const resolved = getTaskModelConfig("any_task", {
    configPath: CONFIG_PATH,
    backend: "ollama",
  });
  expect(resolved.backend).toBe("ollama");
  expect(resolved.generateModel).toBe("gemma4:31b");
  expect(resolved.critiqueModel).toBe("gemini-3.8-flash-medium");
  expect(resolved.critiqueBackend).toBe("agy");
});
