import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { ScriptInfo, OllamaTestResult, EmailTestResult } from "../types";
import { getScript, saveSettings, runScript, stopScript } from "../api/scripts";
import { testOllama, testEmail } from "../api/diagnostics";

export function ScriptDetail() {
  const { name } = useParams<{ name: string }>();
  const decodedName = name ? decodeURIComponent(name) : "";

  const [script, setScript] = useState<ScriptInfo | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Diagnostics
  const [testingOllama, setTestingOllama] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<OllamaTestResult | null>(
    null,
  );
  const [emailResult, setEmailResult] = useState<EmailTestResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!decodedName) return;
    getScript(decodedName).then((s) => {
      setScript(s);
      const defaults: Record<string, string> = {};
      for (const setting of s.settings) {
        defaults[setting.key] = setting.savedValue ?? setting.defaultValue ?? "";
      }
      setSettings(defaults);
    });
  }, [decodedName]);

  const handleSave = async () => {
    if (!script) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await saveSettings(script.name, settings);
      setSaveMessage("Settings saved.");
    } catch (err) {
      setSaveMessage(`Error: ${err}`);
    }
    setSaving(false);
  };

  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaResult(null);
    try {
      const result = await testOllama();
      setOllamaResult(result);
    } catch (err) {
      setOllamaResult({
        success: false,
        message: `${err}`,
        availableModels: [],
      });
    }
    setTestingOllama(false);
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailResult(null);
    try {
      const credentialPath = settings["credentialPath"] || "/app/config";
      const result = await testEmail(credentialPath);
      setEmailResult(result);
    } catch (err) {
      setEmailResult({
        success: false,
        message: `${err}`,
        credentialFileFound: false,
        tokenFileFound: false,
      });
    }
    setTestingEmail(false);
  };

  const handleRun = async () => {
    if (!script) return;
    setRunning(true);
    setScript((prev) => prev ? { ...prev, state: "running" } : prev);
    try {
      const result = await runScript(script.name);
      setScript((prev) => prev ? { ...prev, state: result.state } : prev);
    } catch {
      setScript((prev) => prev ? { ...prev, state: "error" } : prev);
    }
    setRunning(false);
  };

  const handleStop = async () => {
    if (!script) return;
    try {
      const result = await stopScript(script.name);
      setScript((prev) => prev ? { ...prev, state: result.state } : prev);
    } catch {
      /* ignore */
    }
  };

  if (!script) {
    return (
      <div className="alert alert-warning">
        Script '{decodedName}' not found. It may have been unloaded or the name
        is incorrect.
        <Link to="/" className="ms-1">
          Return to Dashboard
        </Link>
        .
      </div>
    );
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <Link to="/">Dashboard</Link>
            </li>
            <li className="breadcrumb-item active">{decodedName}</li>
          </ol>
        </nav>
        <div className="d-flex align-items-center gap-2">
          {script.state === "running" ? (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleStop}
            >
              <i className="bi bi-stop-fill me-1"></i>Stop
            </button>
          ) : (
            <button
              className="btn btn-success btn-sm"
              onClick={handleRun}
              disabled={running}
            >
              {running ? (
                <span className="spinner-border spinner-border-sm me-1"></span>
              ) : (
                <i className="bi bi-play-fill me-1"></i>
              )}
              Run
            </button>
          )}
          <span
            className={`badge ${
              script.state === "running"
                ? "bg-success"
                : script.state === "error"
                  ? "bg-danger"
                  : "bg-secondary"
            }`}
          >
            {script.state}
          </span>
        </div>
      </div>

      <div className="row">
        {/* Settings Panel */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>Settings
              </h5>
            </div>
            <div className="card-body">
              {script.settings.map((setting) => (
                <div key={setting.key} className="mb-3">
                  <label className="form-label fw-semibold">
                    {setting.displayName}
                  </label>
                  {setting.type === "text" && (
                    <input
                      type="text"
                      className="form-control"
                      value={settings[setting.key] ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          [setting.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                  {setting.type === "number" && (
                    <input
                      type="number"
                      className="form-control"
                      min={setting.min ?? undefined}
                      max={setting.max ?? undefined}
                      value={settings[setting.key] ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          [setting.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                  {setting.type === "toggle" && (
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={
                          settings[setting.key]?.toLowerCase() === "true"
                        }
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            [setting.key]: e.target.checked ? "true" : "false",
                          }))
                        }
                      />
                    </div>
                  )}
                  {setting.type === "slider" && (
                    <div className="d-flex align-items-center gap-2">
                      <span className="text-muted small">{setting.min}</span>
                      <input
                        type="range"
                        className="form-range flex-fill"
                        min={setting.min ?? 0}
                        max={setting.max ?? 100}
                        value={settings[setting.key] ?? ""}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            [setting.key]: e.target.value,
                          }))
                        }
                      />
                      <span className="badge bg-primary">
                        {settings[setting.key]}
                      </span>
                      <span className="text-muted small">{setting.max}</span>
                    </div>
                  )}
                </div>
              ))}

              <button
                className="btn btn-primary mt-2"
                onClick={handleSave}
                disabled={saving}
              >
                {saving && (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                )}
                <i className="bi bi-check-lg me-1"></i>Save Settings
              </button>

              {saveMessage && (
                <span className="ms-2 text-success small">{saveMessage}</span>
              )}
            </div>
          </div>
        </div>

        {/* Diagnostics Panel */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-wrench me-2"></i>Diagnostics
              </h5>
            </div>
            <div className="card-body">
              {/* Test Ollama */}
              <div className="mb-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={handleTestOllama}
                    disabled={testingOllama}
                  >
                    {testingOllama && (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    )}
                    <i className="bi bi-robot me-1"></i>Test Ollama Connection
                  </button>
                </div>
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
                          {ollamaResult.availableModels.map((model) => (
                            <li key={model}>
                              <code>{model}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              <hr />

              {/* Test Email */}
              <div className="mb-0">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                  >
                    {testingEmail && (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    )}
                    <i className="bi bi-envelope-check me-1"></i>Test Email
                    Credentials
                  </button>
                </div>
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
                          <li>Click the "Run" button on this script (or run it from the Dashboard).</li>
                          <li>A Google sign-in page will open in your browser.</li>
                          <li>Approve Gmail access to generate the OAuth token.</li>
                          <li>Run this test again to confirm the token was created.</li>
                        </ol>
                      </div>
                    )}
                    {!emailResult.credentialFileFound && (
                      <div className="alert alert-info py-2 mt-2 small mb-0">
                        <strong>Setup:</strong> Go to{" "}
                        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                          Google Cloud Console
                        </a>{" "}
                        &rarr; Create an OAuth 2.0 Client ID (Desktop type) &rarr; Download
                        the JSON file and save it as <code>credentials.json</code> in the
                        credential path configured in Settings.
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
