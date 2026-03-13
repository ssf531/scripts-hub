export interface ScriptInfo {
  name: string;
  description: string;
  version: string;
  author: string;
  icon: string;
  cronExpression: string | null;
  settings: SettingDefinition[];
  state: string;
}

export interface SettingDefinition {
  key: string;
  displayName: string;
  type: "text" | "number" | "toggle" | "slider";
  defaultValue: string | null;
  savedValue: string | null;
  min: number | null;
  max: number | null;
}

export interface ScriptRunResult {
  success: boolean;
  message: string;
  state: string;
}

export interface ScriptRunRecord {
  id: number;
  scriptName: string;
  startedAt: string;
  completedAt: string | null;
  success: boolean;
  resultMessage: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  scriptName: string;
}

export interface OllamaTestResult {
  success: boolean;
  message: string;
  availableModels: string[];
}

export interface EmailTestResult {
  success: boolean;
  message: string;
  credentialFileFound: boolean;
  tokenFileFound: boolean;
}

export interface GlobalConfig {
  ollamaUrl: string;
  defaultModel: string;
  credentialPath: string;
  pluginDirectory: string;
}
