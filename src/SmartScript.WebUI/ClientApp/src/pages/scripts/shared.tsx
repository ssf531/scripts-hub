import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ScriptInfo, SettingDefinition } from "../../types";
import { getScript, saveSettings } from "../../api/scripts";
import { useLogHub } from "../../hooks/useLogHub";
import { LogConsole } from "../../components/LogConsole";

// ---------------------------------------------------------------------------
// Hook — loads script + manages settings state
// ---------------------------------------------------------------------------
export function useScriptPage(scriptName: string) {
  const [script, setScript] = useState<ScriptInfo | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { logs, clearLogs, connectionError } = useLogHub({ scriptName });

  useEffect(() => {
    if (!scriptName) return;
    getScript(scriptName).then((s) => {
      setScript(s);
      const defaults: Record<string, string> = {};
      for (const setting of s.settings) {
        defaults[setting.key] = setting.savedValue ?? setting.defaultValue ?? "";
      }
      setSettings(defaults);
    });
  }, [scriptName]);

  /** Returns a stable setter for a given settings key. */
  const set = (key: string) => (val: string) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

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

  return { script, settings, set, saving, saveMessage, handleSave, logs, clearLogs, connectionError };
}

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------
export function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="breadcrumb" className="mb-3">
      <ol className="breadcrumb">
        <li className="breadcrumb-item"><Link to="/">Dashboard</Link></li>
        <li className="breadcrumb-item active">{name}</li>
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Single setting field renderer
// ---------------------------------------------------------------------------
export function SettingField({
  setting,
  value,
  onChange,
}: {
  setting: SettingDefinition;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="mb-3">
      {setting.displayName && (
        <label className="form-label fw-semibold">{setting.displayName}</label>
      )}

      {setting.type === "text" && (
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {setting.type === "textarea" && (
        <textarea
          className="form-control font-monospace"
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {setting.type === "number" && (
        <input
          type="number"
          className="form-control"
          min={setting.min ?? undefined}
          max={setting.max ?? undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {setting.type === "toggle" && (
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            checked={value?.toLowerCase() === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
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
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="badge bg-primary">{value}</span>
          <span className="text-muted small">{setting.max}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save button + message
// ---------------------------------------------------------------------------
export function SaveBar({
  saving,
  message,
  onSave,
}: {
  saving: boolean;
  message: string | null;
  onSave: () => void;
}) {
  return (
    <div className="d-flex align-items-center gap-2 mt-1">
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
        <i className="bi bi-check-lg me-1"></i>Save Settings
      </button>
      {message && <span className="text-success small">{message}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log console section
// ---------------------------------------------------------------------------
export function ScriptLogs({
  logs,
  clearLogs,
  connectionError,
}: {
  logs: ReturnType<typeof useLogHub>["logs"];
  clearLogs: () => void;
  connectionError: string | null;
}) {
  return (
    <div className="row">
      <div className="col-12 mb-4">
        <LogConsole logs={logs} onClear={clearLogs} connectionError={connectionError} />
      </div>
    </div>
  );
}
