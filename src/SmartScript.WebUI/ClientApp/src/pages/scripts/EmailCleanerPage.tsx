import { useState } from "react";
import type { OllamaTestResult, EmailTestResult } from "../../types";
import { testOllama, testEmail } from "../../api/diagnostics";
import {
  useScriptPage,
  Breadcrumb,
  SettingField,
  SaveBar,
} from "./shared";

export function EmailCleanerPage({ scriptName }: { scriptName: string }) {
  const { script, settings, set, saving, saveMessage, handleSave } =
    useScriptPage(scriptName);

  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<OllamaTestResult | null>(null);

  const [testingEmail, setTestingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailTestResult | null>(null);

  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaResult(null);
    try {
      setOllamaResult(await testOllama());
    } catch (err) {
      setOllamaResult({ success: false, message: `${err}`, availableModels: [] });
    }
    setTestingOllama(false);
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailResult(null);
    try {
      setEmailResult(await testEmail(settings["credentialPath"] || "/app/config"));
    } catch (err) {
      setEmailResult({ success: false, message: `${err}`, credentialFileFound: false, tokenFileFound: false });
    }
    setTestingEmail(false);
  };

  if (!script) return null;

  return (
    <>
      <Breadcrumb name={scriptName} />

      <div className="row mb-4">
        {/* Settings */}
        <div className="col-md-6 mb-4 mb-md-0">
          <div className="card shadow-sm h-100">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>Settings
              </h5>
            </div>
            <div className="card-body d-flex flex-column">
              <div className="flex-fill">
                {script.settings.map((s) => (
                  <SettingField
                    key={s.key}
                    setting={s}
                    value={settings[s.key] ?? ""}
                    onChange={set(s.key)}
                  />
                ))}
              </div>
              <SaveBar saving={saving} message={saveMessage} onSave={handleSave} />
            </div>
          </div>
        </div>

        {/* Diagnostics */}
        <div className="col-md-6">
          <div className="card shadow-sm h-100">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-wrench me-2"></i>Diagnostics
              </h5>
            </div>
            <div className="card-body">
              {/* Ollama */}
              <div className="mb-3">
                <button
                  className="btn btn-outline-primary btn-sm mb-2"
                  onClick={handleTestOllama}
                  disabled={testingOllama}
                >
                  {testingOllama && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-robot me-1"></i>Test Ollama Connection
                </button>
                {ollamaResult && (
                  <>
                    <div
                      className={`alert ${ollamaResult.success ? "alert-success" : "alert-danger"} py-2 mb-2`}
                    >
                      <i
                        className={`bi ${ollamaResult.success ? "bi-check-circle" : "bi-x-circle"} me-1`}
                      ></i>
                      {ollamaResult.message}
                    </div>
                    {ollamaResult.availableModels.length > 0 && (
                      <div className="small">
                        <strong>Available models:</strong>
                        <ul className="mb-0 ps-3">
                          {ollamaResult.availableModels.map((m) => (
                            <li key={m}><code>{m}</code></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              <hr />

              {/* Email Credentials */}
              <div>
                <button
                  className="btn btn-outline-primary btn-sm mb-2"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                >
                  {testingEmail && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-envelope-check me-1"></i>Test Email Credentials
                </button>
                {emailResult && (
                  <>
                    <div
                      className={`alert ${emailResult.success ? "alert-success" : "alert-danger"} py-2 mb-2`}
                    >
                      <i
                        className={`bi ${emailResult.success ? "bi-check-circle" : "bi-x-circle"} me-1`}
                      ></i>
                      {emailResult.message}
                    </div>
                    <div className="small text-muted">
                      <div>
                        <i
                          className={`bi ${emailResult.credentialFileFound ? "bi-check text-success" : "bi-x text-danger"} me-1`}
                        ></i>
                        credentials.json
                      </div>
                      <div>
                        <i
                          className={`bi ${emailResult.tokenFileFound ? "bi-check text-success" : "bi-x text-danger"} me-1`}
                        ></i>
                        OAuth token
                      </div>
                    </div>
                    {emailResult.credentialFileFound && !emailResult.tokenFileFound && (
                      <div className="alert alert-info py-2 mt-2 small mb-0">
                        <strong>Next steps:</strong>
                        <ol className="mb-0 ps-3 mt-1">
                          <li>Click "Run" on this script from the Dashboard.</li>
                          <li>Approve Gmail access in the browser that opens.</li>
                          <li>Run this test again to confirm the token was created.</li>
                        </ol>
                      </div>
                    )}
                    {!emailResult.credentialFileFound && (
                      <div className="alert alert-info py-2 mt-2 small mb-0">
                        <strong>Setup:</strong> Go to{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Google Cloud Console
                        </a>{" "}
                        &rarr; Create an OAuth 2.0 Client ID (Desktop type) &rarr; Save as{" "}
                        <code>credentials.json</code> in the configured credential path.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
