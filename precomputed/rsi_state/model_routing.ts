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
  backend?: "claude" | "agy";
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

/**
 * Throws rather than silently falling back to a hardcoded default when a task type has no entry —
 * an uncontrolled model choice is exactly the kind of thing that went unnoticed in PR #54's real
 * runs until someone happened to inspect a generation record (see
 * RSIAgentDesignRetrospective.md's finding #2). Every task type must have an explicit entry in
 * model_routing_config.json before it can run.
 */
export function getTaskModelConfig(
  taskType: string, configPath = DEFAULT_CONFIG_PATH,
): TaskModelConfig {
  const config = readModelRoutingConfig(configPath)[taskType];
  if (!config) {
    throw new Error(`No model routing config for task type "${taskType}" in ${configPath}`);
  }
  return config;
}
