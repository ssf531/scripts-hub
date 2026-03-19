import { apiFetch } from "./client";
import type { ScriptInfo, ScriptRunResult } from "../types";

export function getScripts(): Promise<ScriptInfo[]> {
  return apiFetch<ScriptInfo[]>("/api/scripts");
}

export function getScript(name: string): Promise<ScriptInfo> {
  return apiFetch<ScriptInfo>(`/api/scripts/${encodeURIComponent(name)}`);
}

export function getSuccessRates(): Promise<Record<string, number>> {
  return apiFetch<Record<string, number>>("/api/scripts/success-rates");
}

export function runScript(name: string): Promise<ScriptRunResult> {
  return apiFetch<ScriptRunResult>(
    `/api/scripts/${encodeURIComponent(name)}/run`,
    {
      method: "POST",
    },
  );
}

export function stopScript(
  name: string,
): Promise<{ success: boolean; state: string }> {
  return apiFetch(`/api/scripts/${encodeURIComponent(name)}/stop`, {
    method: "POST",
  });
}

export function saveSettings(
  name: string,
  settings: Record<string, string>,
): Promise<{ success: boolean; message: string }> {
  return apiFetch(`/api/scripts/${encodeURIComponent(name)}/settings`, {
    method: "POST",
    body: JSON.stringify(settings),
  });
}
