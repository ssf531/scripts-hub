import { apiFetch } from "./client";
import type { ScriptRunRecord } from "../types";

export function getRecentRuns(count = 50): Promise<ScriptRunRecord[]> {
  const params = new URLSearchParams({ count: String(count) });
  return apiFetch<ScriptRunRecord[]>(`/api/history/recent?${params.toString()}`);
}

