import { apiFetch } from "./client";
import type { OllamaTestResult, EmailTestResult } from "../types";

export function testOllama(): Promise<OllamaTestResult> {
  return apiFetch<OllamaTestResult>("/api/diagnostics/test-ollama", {
    method: "POST",
  });
}

export function testEmail(credentialPath?: string): Promise<EmailTestResult> {
  return apiFetch<EmailTestResult>("/api/diagnostics/test-email", {
    method: "POST",
    body: JSON.stringify({ credentialPath: credentialPath || null }),
  });
}
