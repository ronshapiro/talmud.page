import * as fs from "fs";
import {writeJson} from "../../util/json_files";
import {getTaskModelConfig, ModelRoutingConfig, readModelRoutingConfig} from "./model_routing";

const CONFIG_PATH = "precomputed/rsi_state/__test_model_routing__.json";
const FALLBACK = {generateModel: "fallback-generate", critiqueModel: "fallback-critique"};

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
  expect(getTaskModelConfig("my_task", FALLBACK, CONFIG_PATH)).toEqual({
    generateModel: "claude-opus-5", critiqueModel: "claude-haiku-4-5",
  });
});

test("getTaskModelConfig falls back when the task type isn't configured", () => {
  writeJson(CONFIG_PATH, {other_task: {generateModel: "x", critiqueModel: "y"}});
  expect(getTaskModelConfig("my_task", FALLBACK, CONFIG_PATH)).toEqual(FALLBACK);
});

test("getTaskModelConfig falls back when there's no config file at all", () => {
  expect(getTaskModelConfig("my_task", FALLBACK, CONFIG_PATH)).toEqual(FALLBACK);
});
