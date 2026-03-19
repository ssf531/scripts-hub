import { useEffect, useState } from "react";
import type { GlobalConfig } from "../types";
import { getConfig } from "../api/config";

export function Settings() {
  const [config, setConfig] = useState<GlobalConfig | null>(null);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  if (!config) {
    return <div className="spinner-border text-primary" role="status"></div>;
  }

  return (
    <>
      <h3 className="mb-4">
        <i className="bi bi-gear-fill me-2"></i>Global Settings
      </h3>

      <div className="row">
        <div className="col-md-6">
          <div className="card shadow-sm mb-4">
            <div className="card-header">
              <h5 className="mb-0">Ollama Configuration</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Ollama API URL</label>
                <input
                  type="text"
                  className="form-control"
                  value={config.ollamaUrl}
                  disabled
                />
                <div className="form-text">
                  Configured via environment variable OLLAMA_BASE_URL or
                  appsettings.json.
                </div>
              </div>
              <div className="mb-0">
                <label className="form-label fw-semibold">Default Model</label>
                <input
                  type="text"
                  className="form-control"
                  value={config.defaultModel}
                  disabled
                />
                <div className="form-text">
                  Configured via <code>Ollama:DefaultModel</code> in
                  appsettings.json. Scripts can override this per-script in their
                  settings.
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm mb-4">
            <div className="card-header">
              <h5 className="mb-0">Plugin Directory</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Path</label>
                <input
                  type="text"
                  className="form-control"
                  value={config.pluginDirectory}
                  disabled
                />
                <div className="form-text">
                  Place compiled .dll plugin files in this directory. They will
                  be auto-discovered on startup.
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header">
              <h5 className="mb-0">Gmail OAuth</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Credential Path</label>
                <input
                  type="text"
                  className="form-control"
                  value={config.credentialPath}
                  disabled
                />
                <div className="form-text">
                  Configured via <code>CredentialPath</code> in appsettings.json.
                  Place your <code>credentials.json</code> in this directory.
                </div>
              </div>
              <p className="text-muted mb-0">
                The authorization flow will start automatically when the Email
                Cleaner script first runs. A Google consent screen will open in
                your browser to approve access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
