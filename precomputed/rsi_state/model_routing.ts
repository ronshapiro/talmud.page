import * as fs from "fs";
import {readUtf8} from "../../files";

/**
 * Per-task-type model choice, in its own git-tracked config file rather than hardcoded per task
 * type — git history is the audit/rollback trail. `generateModel` and `critiqueModel` can differ,
 * since critique is a narrower, more mechanical check than generation. Starting values are a
 * judgment call; a later "routing tuner" (Phase 4 — not built yet) is meant to propose changes to
 * this file from logged per-(task type, model) acceptance-rate and edit-distance stats in
 * spend_ledger.ts and generation_record.ts, rather than this being hand-tuned indefinitely.
 */

export interface TaskModelConfig {
  generateModel: string;
  critiqueModel: string;
}

export type ModelRoutingConfig = Record<string, TaskModelConfig>;

// Deliberately not "model_routing.json" — a same-basename data file next to a same-named .ts
// module is resolved as the .json file by Node's default extension order when imported without
// an extension, silently shadowing the module itself.
const DEFAULT_CONFIG_PATH = "precomputed/rsi_state/model_routing_config.json";

export function readModelRoutingConfig(configPath = DEFAULT_CONFIG_PATH): ModelRoutingConfig {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(readUtf8(configPath)) as ModelRoutingConfig;
}

export function getTaskModelConfig(
  taskType: string, fallback: TaskModelConfig, configPath = DEFAULT_CONFIG_PATH,
): TaskModelConfig {
  return readModelRoutingConfig(configPath)[taskType] ?? fallback;
}
