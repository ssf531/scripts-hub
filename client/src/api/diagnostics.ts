import { apiFetch } from "./client";
import type { OllamaTestResult, EmailTestResult, M3u8DLTestResult } from "../types";

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

export function testM3u8DL(executablePath?: string): Promise<M3u8DLTestResult> {
  return apiFetch<M3u8DLTestResult>("/api/diagnostics/test-m3u8dl", {
    method: "POST",
    body: JSON.stringify({ executablePath: executablePath || null }),
  });
}
