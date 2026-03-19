import {
  useScriptPage,
  Breadcrumb,
  SettingField,
  SaveBar,
  ScriptLogs,
} from "./shared";

export function GenericScriptPage({ scriptName }: { scriptName: string }) {
  const { script, settings, set, saving, saveMessage, handleSave, logs, clearLogs, connectionError } =
    useScriptPage(scriptName);

  if (!script) return null;

  return (
    <>
      <Breadcrumb name={scriptName} />

      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>Settings
              </h5>
            </div>
            <div className="card-body">
              {script.settings.length === 0 && (
                <p className="text-muted mb-3">This script has no configurable settings.</p>
              )}
              {script.settings.map((s) => (
                <SettingField
                  key={s.key}
                  setting={s}
                  value={settings[s.key] ?? ""}
                  onChange={set(s.key)}
                />
              ))}
              {script.settings.length > 0 && (
                <SaveBar saving={saving} message={saveMessage} onSave={handleSave} />
              )}
            </div>
          </div>
        </div>
      </div>

      <ScriptLogs logs={logs} clearLogs={clearLogs} connectionError={connectionError} />
    </>
  );
}
