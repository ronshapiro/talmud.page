import * as fs from "fs";
import {writeJson} from "../../util/json_files";
import {getTaskModelConfig, ModelRoutingConfig, readModelRoutingConfig} from "./model_routing";

const CONFIG_PATH = "precomputed/rsi_state/__test_model_routing__.json";

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

test("getTaskModelConfig returns the configured entry when present", () => {
  writeJson(CONFIG_PATH, {
    my_task: {generateModel: "claude-opus-5", critiqueModel: "claude-haiku-4-5"},
  });
  expect(getTaskModelConfig("my_task", CONFIG_PATH)).toEqual({
    generateModel: "claude-opus-5", critiqueModel: "claude-haiku-4-5",
  });
});

test("getTaskModelConfig throws when the task type isn't configured", () => {
  writeJson(CONFIG_PATH, {other_task: {generateModel: "x", critiqueModel: "y"}});
  expect(() => getTaskModelConfig("my_task", CONFIG_PATH)).toThrow(/my_task/);
});

test("getTaskModelConfig throws when there's no config file at all", () => {
  expect(() => getTaskModelConfig("my_task", CONFIG_PATH)).toThrow(/my_task/);
});

test("getTaskModelConfig returns named config under backend group", () => {
  writeJson(CONFIG_PATH, {
    my_task: {
      backend: "claude",
      generateModel: "default-gen",
      critiqueModel: "default-crit",
      configs: {
        agy: {
          "claude-sonnet-4.6": {
            generateModel: "claude-sonnet-4-6",
            critiqueModel: "gemini-3.8-flash-medium",
          },
        },
      },
    },
  });

  const resolved = getTaskModelConfig("my_task", {
    configPath: CONFIG_PATH,
    backend: "agy",
    configName: "claude-sonnet-4.6",
  });
  expect(resolved).toEqual({
    backend: "agy",
    generateModel: "claude-sonnet-4-6",
    critiqueModel: "gemini-3.8-flash-medium",
    configs: expect.any(Object),
  });
});

test("getTaskModelConfig fuzzy matches hyphens and dots in configName", () => {
  writeJson(CONFIG_PATH, {
    my_task: {
      backend: "agy",
      generateModel: "default-gen",
      critiqueModel: "default-crit",
      configs: {
        agy: {
          "claude-sonnet-4.6": {
            generateModel: "claude-sonnet-4-6",
            critiqueModel: "gemini-3.8-flash-medium",
          },
        },
      },
    },
  });

  const resolved = getTaskModelConfig("my_task", {
    configPath: CONFIG_PATH,
    backend: "agy",
    configName: "claude-sonnet-4-6",
  });
  expect(resolved.generateModel).toBe("claude-sonnet-4-6");
  expect(resolved.critiqueModel).toBe("gemini-3.8-flash-medium");
});

test("getTaskModelConfig infers backend from config group if backend omitted", () => {
  writeJson(CONFIG_PATH, {
    my_task: {
      backend: "claude",
      generateModel: "default-gen",
      critiqueModel: "default-crit",
      configs: {
        agy: {
          "claude-sonnet-4.6": {
            generateModel: "claude-sonnet-4-6",
            critiqueModel: "gemini-3.8-flash-medium",
          },
        },
      },
    },
  });

  const resolved = getTaskModelConfig("my_task", {
    configPath: CONFIG_PATH,
    configName: "claude-sonnet-4.6",
  });
  expect(resolved.backend).toBe("agy");
  expect(resolved.generateModel).toBe("claude-sonnet-4-6");
});

test("getTaskModelConfig throws descriptive error for unknown configName", () => {
  writeJson(CONFIG_PATH, {
    my_task: {
      backend: "agy",
      generateModel: "default-gen",
      critiqueModel: "default-crit",
      configs: {
        agy: {
          "claude-sonnet-4.6": {
            generateModel: "claude-sonnet-4-6",
            critiqueModel: "gemini-3.8-flash-medium",
          },
        },
      },
    },
  });

  expect(() => getTaskModelConfig("my_task", {
    configPath: CONFIG_PATH,
    backend: "agy",
    configName: "nonexistent",
  })).toThrow(/Unknown model config "nonexistent".*claude-sonnet-4.6/);
});
