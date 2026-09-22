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
  const config: ModelRoutingConfig = {
    my_task: {generateModel: "claude-opus-5", critiqueModel: "claude-haiku-4-5"},
  };
  writeJson(CONFIG_PATH, config);
  expect(readModelRoutingConfig(CONFIG_PATH)).toEqual(config);
});

test("getTaskModelConfig returns the configured entry when present (legacy flat format)", () => {
  writeJson(CONFIG_PATH, {
    my_task: {generateModel: "claude-opus-5", critiqueModel: "claude-haiku-4-5"},
  });
  expect(getTaskModelConfig("my_task", CONFIG_PATH)).toEqual({
    generateModel: "claude-opus-5",
    critiqueModel: "claude-haiku-4-5",
  });
});

test("getTaskModelConfig throws when the task type isn't configured", () => {
  writeJson(CONFIG_PATH, {other_task: {generateModel: "x", critiqueModel: "y"}});
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

test("actual model_routing_config.json resolves agy default and sonnet-4.6", () => {
  const agyDefault = getTaskModelConfig("rashi_tosafot_translation");
  expect(agyDefault.backend).toBe("agy");
  expect(agyDefault.generateModel).toBe("gemini-3.8-flash-high");
  expect(agyDefault.critiqueModel).toBe("gemini-3.8-flash-medium");

  const agySonnet = getTaskModelConfig("rashi_tosafot_translation", {
    backend: "agy",
    configName: "claude-sonnet-4.6",
  });
  expect(agySonnet.backend).toBe("agy");
  expect(agySonnet.generateModel).toBe("claude-sonnet-4-6");
  expect(agySonnet.critiqueModel).toBe("gemini-3.8-flash-medium");

  const claudeDefault = getTaskModelConfig("rashi_tosafot_translation", {
    backend: "claude",
  });
  expect(claudeDefault.backend).toBe("claude");
  expect(claudeDefault.generateModel).toBe("claude-sonnet-5");
  expect(claudeDefault.critiqueModel).toBe("claude-sonnet-5");
});
