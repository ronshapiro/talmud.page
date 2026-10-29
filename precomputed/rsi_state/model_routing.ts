import * as fs from "fs";
import {readUtf8} from "../../files";
import {AgentBackend} from "../../rsi_orchestrator/agent_runner";

/**
 * Model routing configuration. Maps backends ("agy", "claude") to their default and
 * optional alternative model configs. Each model config specifies generateModel and critiqueModel.
 */

export interface ModelConfig {
  generateModel: string;
  critiqueModel: string;
  critiqueBackend?: AgentBackend;
}

export interface TaskModelConfig extends ModelConfig {
  backend: AgentBackend;
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
  return s.toLowerCase().replace(/[\s._]/g, "-");
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
    const normGenNoEffort = normGen.replace(/-(?:high|medium|low)$/, "");
    if (normGenNoEffort === normQuery) return true;
    if (normGenNoEffort.replace(/^claude-/, "") === normQuery.replace(/^claude-/, "")) return true;
  }
  return false;
}

function findMatchingConfig(
  configurations: BackendConfigs | undefined,
  queryName: string,
): ModelConfig | undefined {
  if (!configurations) return undefined;
  for (const [key, configuration] of Object.entries(configurations)) {
    if (matchesConfig(key, queryName, configuration)) {
      return configuration;
    }
  }
  return undefined;
}

function toTaskModelConfig(backend: AgentBackend, configuration: ModelConfig): TaskModelConfig {
  return {
    ...configuration,
    backend,
  };
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
  } else if ("agy" in raw || "claude" in raw || "ollama" in raw) {
    backends = raw;
  } else {
    throw new Error(`No model routing config for task type "${taskType}" in ${configPath}`);
  }
  const requestedConfig = options.configName;
  const requestedBackend = options.backend;

  if (requestedBackend) {
    const baseBackend = requestedBackend.endsWith("-long-thread")
      ? requestedBackend.replace(/-long-thread$/, "")
      : undefined;
    const directConfigs = backends[requestedBackend];
    const baseConfigs = baseBackend ? backends[baseBackend] : undefined;

    if (!directConfigs && !baseConfigs) {
      const available = Object.keys(backends).join(", ");
      throw new Error(
        `Unknown backend "${requestedBackend}". Available backends: ${available}`);
    }

    if (requestedConfig) {
      const matchedConfig = findMatchingConfig(directConfigs, requestedConfig)
        ?? findMatchingConfig(baseConfigs, requestedConfig);

      if (matchedConfig) {
        return toTaskModelConfig(requestedBackend as AgentBackend, matchedConfig);
      }

      const allAvailableConfigs = {
        ...(baseConfigs ?? {}),
        ...(directConfigs ?? {}),
      };
      const available = Object.keys(allAvailableConfigs).join(", ");
      throw new Error(
        `Unknown model config "${requestedConfig}" for backend "${requestedBackend}". `
        + `Available configs: ${available}`);
    }

    const singleDirectConfig = directConfigs && Object.keys(directConfigs).length === 1
      ? Object.values(directConfigs)[0]
      : undefined;
    const singleBaseConfig = baseConfigs && Object.keys(baseConfigs).length === 1
      ? Object.values(baseConfigs)[0]
      : undefined;

    const defaultConfig = directConfigs?.default
      ?? baseConfigs?.default
      ?? singleDirectConfig
      ?? singleBaseConfig;

    if (!defaultConfig) {
      const allAvailableConfigs = {
        ...(baseConfigs ?? {}),
        ...(directConfigs ?? {}),
      };
      const available = Object.keys(allAvailableConfigs).join(", ");
      throw new Error(
        `Backend "${requestedBackend}" has no default config. Available configs: ${available}`);
    }
    return toTaskModelConfig(requestedBackend as AgentBackend, defaultConfig);
  }

  if (requestedConfig) {
    for (const [backendName, backendConfigs] of Object.entries(backends)) {
      for (const [key, cfg] of Object.entries(backendConfigs)) {
        if (matchesConfig(key, requestedConfig, cfg)) {
          return toTaskModelConfig(backendName as AgentBackend, cfg);
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
    : Object.keys(backends)[0]) as AgentBackend;
  const defaultBackendConfigs = backends[defaultBackend];
  const defaultCfg = defaultBackendConfigs.default
    ?? Object.values(defaultBackendConfigs)[0];
  if (!defaultCfg) {
    throw new Error(`No default model configuration found in ${configPath}`);
  }
  return toTaskModelConfig(defaultBackend, defaultCfg);
}
