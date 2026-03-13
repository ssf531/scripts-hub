import { useState } from "react";
import type { M3u8DLTestResult } from "../../types";
import { testM3u8DL } from "../../api/diagnostics";
import {
  useScriptPage,
  Breadcrumb,
  SettingField,
  SaveBar,
  ScriptLogs,
} from "./shared";

export function M3u8DownloaderPage({ scriptName }: { scriptName: string }) {
  const { script, settings, set, saving, saveMessage, handleSave, logs, clearLogs, connectionError } =
    useScriptPage(scriptName);

  const [testingExe, setTestingExe] = useState(false);
  const [exeResult, setExeResult] = useState<M3u8DLTestResult | null>(null);

  const handleTestExe = async () => {
    setTestingExe(true);
    setExeResult(null);
    try {
      setExeResult(await testM3u8DL(settings["executablePath"] || "N_m3u8DL-RE"));
    } catch (err) {
      setExeResult({ success: false, message: `${err}`, resolvedPath: null });
    }
    setTestingExe(false);
  };

  if (!script) return null;

  const queueSetting = script.settings.find((s) => s.key === "downloadQueue");
  const otherSettings = script.settings.filter((s) => s.key !== "downloadQueue");

  return (
    <>
      <Breadcrumb name={scriptName} />

      {/* Row 1: Queue (col-8) + Diagnostics (col-4) */}
      <div className="row mb-4">
        {/* Download Queue */}
        <div className="col-md-8 mb-4 mb-md-0">
          <div className="card shadow-sm h-100">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-collection-play me-2"></i>Download Queue
              </h5>
            </div>
            <div className="card-body d-flex flex-column">
              <p className="text-muted small mb-2">
                One download per line —{" "}
                <code className="text-body-secondary">URL|Filename</code> or just a URL
                (filename is auto-detected from the URL).
              </p>
              {queueSetting && (
                <SettingField
                  setting={{ ...queueSetting, displayName: "" }}
                  value={settings[queueSetting.key] ?? ""}
                  onChange={set(queueSetting.key)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Diagnostics */}
        <div className="col-md-4">
          <div className="card shadow-sm h-100">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-wrench me-2"></i>Diagnostics
              </h5>
            </div>
            <div className="card-body">
              <p className="text-muted small mb-3">
                Verify that N_m3u8DL-RE is installed and reachable before running.
              </p>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={handleTestExe}
                disabled={testingExe}
              >
                {testingExe && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-terminal me-1"></i>Test N_m3u8DL-RE
              </button>

              {exeResult && (
                <div className="mt-3">
                  <div
                    className={`alert ${exeResult.success ? "alert-success" : "alert-danger"} py-2 mb-2`}
                  >
                    <i
                      className={`bi ${exeResult.success ? "bi-check-circle" : "bi-x-circle"} me-1`}
                    ></i>
                    {exeResult.message}
                  </div>
                  {exeResult.resolvedPath && (
                    <div className="small text-muted text-break">
                      <i className="bi bi-folder me-1"></i>
                      <code>{exeResult.resolvedPath}</code>
                    </div>
                  )}
                  {!exeResult.success && (
                    <div className="alert alert-info py-2 mt-2 small mb-0">
                      <strong>Setup:</strong> Download N_m3u8DL-RE from{" "}
                      <a
                        href="https://github.com/nilaoda/N_m3u8DL-RE/releases"
                        target="_blank"
                        rel="noreferrer"
                      >
                        GitHub Releases
                      </a>
                      , place it in your PATH or enter the full path in{" "}
                      <em>Settings</em> below.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Settings (compact, 3 columns) */}
      <div className="row mb-3">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>Settings
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                {otherSettings.map((s) => (
                  <div key={s.key} className="col-md-4">
                    <SettingField
                      setting={s}
                      value={settings[s.key] ?? ""}
                      onChange={set(s.key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save row */}
      <div className="row mb-4">
        <div className="col-12">
          <SaveBar saving={saving} message={saveMessage} onSave={handleSave} />
        </div>
      </div>

      <ScriptLogs logs={logs} clearLogs={clearLogs} connectionError={connectionError} />
    </>
  );
}
