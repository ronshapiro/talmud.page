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
