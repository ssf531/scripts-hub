import { apiFetch } from "./client";
import type { GlobalConfig } from "../types";

export function getConfig(): Promise<GlobalConfig> {
  return apiFetch<GlobalConfig>("/api/config");
}
