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

export interface BaseTaskModelConfig {
  backend?: "claude" | "agy";
  generateModel: string;
  critiqueModel: string;
}

export interface TaskModelConfig extends BaseTaskModelConfig {
  configs?: Record<string, BaseTaskModelConfig | Record<string, BaseTaskModelConfig>>;
}

export type ModelRoutingConfig = Record<string, TaskModelConfig>;

export interface ModelConfigLookupOptions {
  configPath?: string;
  configName?: string;
  backend?: string;
}

// Deliberately not "model_routing.json" — a same-basename data file next to a same-named .ts
// module is resolved as the .json file by Node's default extension order when imported without
// an extension, silently shadowing the module itself.
const DEFAULT_CONFIG_PATH = "precomputed/rsi_state/model_routing_config.json";

export function readModelRoutingConfig(configPath = DEFAULT_CONFIG_PATH): ModelRoutingConfig {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(readUtf8(configPath)) as ModelRoutingConfig;
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[._]/g, "-");
}

/**
 * Throws rather than silently falling back to a hardcoded default when a task type has no entry —
 * an uncontrolled model choice is exactly the kind of thing that went unnoticed in PR #54's real
 * runs until someone happened to inspect a generation record (see
 * RSIAgentDesignRetrospective.md's finding #2). Every task type must have an explicit entry in
 * model_routing_config.json before it can run.
 */
export function getTaskModelConfig(
  taskType: string,
  configPathOrOptions: string | ModelConfigLookupOptions = DEFAULT_CONFIG_PATH,
): TaskModelConfig {
  const options: ModelConfigLookupOptions = typeof configPathOrOptions === "string"
    ? {configPath: configPathOrOptions}
    : configPathOrOptions;
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const config = readModelRoutingConfig(configPath)[taskType];
  if (!config) {
    throw new Error(`No model routing config for task type "${taskType}" in ${configPath}`);
  }

  if (!options.configName) {
    return config;
  }

  const requestedName = options.configName;
  const normalizedTarget = normalizeKey(requestedName);

  const availableConfigs: string[] = [];
  let match: BaseTaskModelConfig | undefined;
  let matchedBackend: "claude" | "agy" | undefined;

  if (config.configs) {
    for (const [key, value] of Object.entries(config.configs)) {
      if (value && typeof value === "object" && !("generateModel" in value)) {
        // Grouped by backend
        const backendGroup = key as "claude" | "agy";
        for (const [subKey, subValue] of Object.entries(
          value as Record<string, BaseTaskModelConfig>,
        )) {
          availableConfigs.push(`${subKey} (${backendGroup})`);
          if (options.backend && options.backend !== backendGroup) {
            continue;
          }
          if (subKey === requestedName || normalizeKey(subKey) === normalizedTarget) {
            match = subValue;
            matchedBackend = subValue.backend ?? backendGroup;
          }
        }
      } else if (value && typeof value === "object" && "generateModel" in value) {
        // Flat entry
        const entry = value as BaseTaskModelConfig;
        availableConfigs.push(entry.backend ? `${key} (${entry.backend})` : key);
        if (options.backend && entry.backend && options.backend !== entry.backend) {
          continue;
        }
        if (key === requestedName || normalizeKey(key) === normalizedTarget) {
          match = entry;
          matchedBackend = entry.backend;
        }
      }
    }
  }

  if (!match) {
    const backendMsg = options.backend ? ` (backend: "${options.backend}")` : "";
    const availableMsg = availableConfigs.length > 0 ? availableConfigs.join(", ") : "none";
    throw new Error(
      `Unknown model config "${requestedName}" for task type "${taskType}"${backendMsg}. Available configs: ${availableMsg}`);
  }

  return {
    backend: (options.backend as "claude" | "agy" | undefined) ?? matchedBackend ?? config.backend,
    generateModel: match.generateModel,
    critiqueModel: match.critiqueModel,
    configs: config.configs,
  };
}
