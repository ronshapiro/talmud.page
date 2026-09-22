import * as fs from "fs";
import {readUtf8} from "../../files";

/**
 * Model routing configuration. Maps backends ("agy", "claude") to their default and
 * optional alternative model configs. Each model config specifies generateModel and critiqueModel.
 */

export interface ModelConfig {
  generateModel: string;
  critiqueModel: string;
}

export interface TaskModelConfig extends ModelConfig {
  backend: "claude" | "agy";
}

export type BackendConfigs = Record<string, ModelConfig>;
export type ModelRoutingConfig = Record<string, BackendConfigs>;

export interface ModelConfigLookupOptions {
  configPath?: string;
  configName?: string;
  backend?: string;
}

const DEFAULT_CONFIG_PATH = "precomputed/rsi_state/model_routing_config.json";

export function readModelRoutingConfig(configPath = DEFAULT_CONFIG_PATH): ModelRoutingConfig {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(readUtf8(configPath)) as ModelRoutingConfig;
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[._]/g, "-");
}

function matchesConfig(key: string, query: string, cfg?: ModelConfig): boolean {
  const normKey = normalizeKey(key);
  const normQuery = normalizeKey(query);
  if (normKey === normQuery) return true;
  if (normKey.replace(/^claude-/, "") === normQuery.replace(/^claude-/, "")) return true;
  if (cfg) {
    const normGen = normalizeKey(cfg.generateModel);
    if (normGen === normQuery) return true;
    if (normGen.replace(/^claude-/, "") === normQuery.replace(/^claude-/, "")) return true;
  }
  return false;
}

/**
 * Resolves the generator and critique model configuration for a task type and backend/preset.
 */
export function getTaskModelConfig(
  taskType: string,
  configPathOrOptions: string | ModelConfigLookupOptions = DEFAULT_CONFIG_PATH,
): TaskModelConfig {
  const options: ModelConfigLookupOptions = typeof configPathOrOptions === "string"
    ? {configPath: configPathOrOptions}
    : configPathOrOptions;
  const configPath = options.configPath ?? DEFAULT_CONFIG_PATH;
  const raw = readModelRoutingConfig(configPath);
  if (!raw || Object.keys(raw).length === 0) {
    throw new Error(`No model routing config for task type "${taskType}" in ${configPath}`);
  }

  const rawObj = raw as Record<string, unknown>;
  let backends: Record<string, BackendConfigs> | undefined;
  if (rawObj[taskType] && typeof rawObj[taskType] === "object") {
    backends = rawObj[taskType] as Record<string, BackendConfigs>;
  } else if ("agy" in raw || "claude" in raw) {
    backends = raw;
  } else {
    throw new Error(`No model routing config for task type "${taskType}" in ${configPath}`);
  }
  const requestedConfig = options.configName;
  const requestedBackend = options.backend;

  if (requestedBackend) {
    const backendConfigs = backends[requestedBackend];
    if (!backendConfigs) {
      const available = Object.keys(backends).join(", ");
      throw new Error(
        `Unknown backend "${requestedBackend}". Available backends: ${available}`);
    }

    if (requestedConfig) {
      for (const [key, cfg] of Object.entries(backendConfigs)) {
        if (matchesConfig(key, requestedConfig, cfg)) {
          return {
            backend: requestedBackend as "claude" | "agy",
            generateModel: cfg.generateModel,
            critiqueModel: cfg.critiqueModel,
          };
        }
      }
      const available = Object.keys(backendConfigs).join(", ");
      throw new Error(
        `Unknown model config "${requestedConfig}" for backend "${requestedBackend}". `
        + `Available configs: ${available}`);
    }

    const defaultCfg = backendConfigs.default
      ?? (Object.keys(backendConfigs).length === 1 ? Object.values(backendConfigs)[0] : undefined);
    if (!defaultCfg) {
      const available = Object.keys(backendConfigs).join(", ");
      throw new Error(
        `Backend "${requestedBackend}" has no default config. Available configs: ${available}`);
    }
    return {
      backend: requestedBackend as "claude" | "agy",
      generateModel: defaultCfg.generateModel,
      critiqueModel: defaultCfg.critiqueModel,
    };
  }

  if (requestedConfig) {
    for (const [backendName, backendConfigs] of Object.entries(backends)) {
      for (const [key, cfg] of Object.entries(backendConfigs)) {
        if (matchesConfig(key, requestedConfig, cfg)) {
          return {
            backend: backendName as "claude" | "agy",
            generateModel: cfg.generateModel,
            critiqueModel: cfg.critiqueModel,
          };
        }
      }
    }
    const allConfigs = Object.entries(backends)
      .flatMap(([b, cfgs]) => Object.keys(cfgs).map(k => `${k} (${b})`));
    throw new Error(
      `Unknown model config "${requestedConfig}". Available configs: ${allConfigs.join(", ")}`);
  }

  const defaultBackend = ("agy" in backends
    ? "agy"
    : Object.keys(backends)[0]) as "claude" | "agy";
  const defaultBackendConfigs = backends[defaultBackend];
  const defaultCfg = defaultBackendConfigs.default
    ?? Object.values(defaultBackendConfigs)[0];
  if (!defaultCfg) {
    throw new Error(`No default model configuration found in ${configPath}`);
  }
  return {
    backend: defaultBackend,
    generateModel: defaultCfg.generateModel,
    critiqueModel: defaultCfg.critiqueModel,
  };
}
