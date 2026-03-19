import { useState, useEffect, useCallback, useRef } from "react";
import type { M3u8DLTestResult } from "../../types";
import { testM3u8DL } from "../../api/diagnostics";
import {
  useScriptPage,
  SettingField,
  SaveBar,
} from "./shared";
import { runScript, stopScript, saveSettings, getScript } from "../../api/scripts";

// ── Queue entry model ──────────────────────────────────────────────────────────

interface QueueEntry {
  url: string;
  name: string;
}

const SEP_RE = /\s*[|\t]\s*|\s{2,}|\s+-\s+/;

function parseQueueText(raw: string): QueueEntry[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const m = SEP_RE.exec(l);
      if (m && m.index > 0) {
        return { url: l.slice(0, m.index).trim(), name: l.slice(m.index + m[0].length).trim() };
      }
      return { url: l, name: "" };
    });
}

function serializeQueue(entries: QueueEntry[]): string {
  return entries
    .filter((e) => e.url.trim())
    .map((e) => (e.name.trim() ? `${e.url.trim()}|${e.name.trim()}` : e.url.trim()))
    .join("\n");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function M3u8DownloaderPage({ scriptName }: { scriptName: string }) {
  const { script, settings, set, saving, saveMessage, handleSave } =
    useScriptPage(scriptName);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  // ── Queue list state ────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [initialized, setInitialized] = useState(false);
  // Distinguishes user edits (should auto-save) from server-loaded updates (should not)
  const userEdited = useRef(false);

  // Initialize once when settings first arrive
  useEffect(() => {
    if (!initialized && settings["downloadQueue"] !== undefined) {
      setEntries(parseQueueText(settings["downloadQueue"]));
      setInitialized(true);
    }
  }, [settings, initialized]);

  // ── Auto-save queue on user edits (debounced, skipped while running) ────────
  useEffect(() => {
    if (!initialized || !userEdited.current || running) return;
    const t = setTimeout(() => {
      userEdited.current = false;
      saveSettings(scriptName, { downloadQueue: serializeQueue(entries) }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [entries, initialized, running, scriptName]);

  // ── Poll queue from DB while running ────────────────────────────────────────
  // The script removes items from the DB as it processes them; polling keeps the
  // UI in sync so the user sees the queue shrink in real time.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      try {
        const s = await getScript(scriptName);
        const q = s.settings.find((st) => st.key === "downloadQueue")?.savedValue ?? "";
        userEdited.current = false; // server update — don't trigger auto-save
        setEntries(parseQueueText(q));
      } catch { /* ignore — log console shows status */ }
    }, 1500);
    return () => clearInterval(id);
  }, [running, scriptName]);

  // Update entries from user interaction
  const updateEntries = useCallback(
    (next: QueueEntry[]) => {
      userEdited.current = true;
      setEntries(next);
      set("downloadQueue")(serializeQueue(next)); // keep settings state in sync for Save Settings
    },
    [set],
  );

  const addRow = () => updateEntries([...entries, { url: "", name: "" }]);

  const removeRow = (i: number) =>
    updateEntries(entries.filter((_, idx) => idx !== i));

  const updateRow = (i: number, field: "url" | "name", value: string) => {
    updateEntries(entries.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  };

  // Paste handler: split pasted text on newlines → add multiple entries at once
  const handlePaste = (e: React.ClipboardEvent, rowIndex: number, field: "url" | "name") => {
    const text = e.clipboardData.getData("text");
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l);
    if (lines.length <= 1) return;
    e.preventDefault();

    const newRows: QueueEntry[] = lines.map((l) => {
      const m = SEP_RE.exec(l);
      if (m && m.index > 0) {
        return { url: l.slice(0, m.index).trim(), name: l.slice(m.index + m[0].length).trim() };
      }
      return field === "name" ? { url: entries[rowIndex]?.url ?? "", name: l } : { url: l, name: "" };
    });

    const next = [...entries];
    next.splice(rowIndex, 1, ...newRows);
    updateEntries(next);
  };

  // ── Add item while running ───────────────────────────────────────────────────
  // Save to DB immediately so the running script picks it up on its next iteration.
  const addRowWhileRunning = async () => {
    // Flush pending entries to DB first, then reload from DB to get current state
    const current = await getScript(scriptName);
    const q = current.settings.find((s) => s.key === "downloadQueue")?.savedValue ?? "";
    const liveEntries = parseQueueText(q);
    const next = [...liveEntries, { url: "", name: "" }];
    userEdited.current = false;
    setEntries(next);
    // Save immediately (no debounce) so the script can see the new slot
    await saveSettings(scriptName, { downloadQueue: serializeQueue(next) }).catch(() => {});
  };

  // ── Run / Stop ──────────────────────────────────────────────────────────────
  const handleRun = async () => {
    // Flush any pending queue changes to DB before starting
    userEdited.current = false;
    await saveSettings(scriptName, { downloadQueue: serializeQueue(entries) }).catch(() => {});

    setRunning(true);
    setRunError(null);
    try {
      await runScript(scriptName);
    } catch (err) {
      setRunError(String(err));
    } finally {
      setRunning(false);
      // Reload final queue state after run completes
      try {
        const s = await getScript(scriptName);
        const q = s.settings.find((st) => st.key === "downloadQueue")?.savedValue ?? "";
        userEdited.current = false;
        setEntries(parseQueueText(q));
      } catch { /* ignore */ }
    }
  };

  const handleStop = async () => {
    try { await stopScript(scriptName); } catch { /* ignore */ }
  };

  // ── Diagnostics ─────────────────────────────────────────────────────────────
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

  const otherSettings = script.settings.filter((s) => s.key !== "downloadQueue");

  return (
    <>
      <h3 className="mb-4">
        <i className="bi bi-cloud-arrow-down me-2"></i>M3U8 Downloader
      </h3>

      {/* Row 1: Download Queue (full width) */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">
                <i className="bi bi-collection-play me-2"></i>Download Queue
                {entries.length > 0 && (
                  <span className="badge bg-secondary ms-2">{entries.length}</span>
                )}
                {running && (
                  <span className="badge bg-warning text-dark ms-2">
                    <span className="spinner-border spinner-border-sm me-1" style={{ width: 10, height: 10 }}></span>
                    Running
                  </span>
                )}
              </h5>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={running ? addRowWhileRunning : addRow}
                >
                  <i className="bi bi-plus-lg me-1"></i>Add
                </button>
                {running ? (
                  <button className="btn btn-warning btn-sm" onClick={handleStop}>
                    <i className="bi bi-stop-fill me-1"></i>Stop
                  </button>
                ) : (
                  <button
                    className="btn btn-success btn-sm"
                    onClick={handleRun}
                    disabled={entries.filter((e) => e.url.trim()).length === 0}
                  >
                    <i className="bi bi-play-fill me-1"></i>Run
                  </button>
                )}
              </div>
            </div>
            <div className="card-body">
              {entries.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-inbox fs-2 d-block mb-2"></i>
                  <div className="small">
                    {running
                      ? "All downloads completed — add more items to keep going."
                      : "No downloads queued. Click Add or paste URLs."}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Header row */}
                  <div className="row gx-2 mb-1">
                    <div className="col">
                      <span className="form-label small text-muted mb-0">URL</span>
                    </div>
                    <div className="col-4">
                      <span className="form-label small text-muted mb-0">Filename (optional)</span>
                    </div>
                    <div style={{ width: "36px" }} />
                  </div>
                  {entries.map((entry, i) => (
                    <div key={i} className="row gx-2 mb-2 align-items-center">
                      <div className="col">
                        <input
                          type="text"
                          className="form-control form-control-sm font-monospace"
                          placeholder="https://example.com/stream.m3u8"
                          value={entry.url}
                          onChange={(e) => updateRow(i, "url", e.target.value)}
                          onPaste={(e) => handlePaste(e, i, "url")}
                          readOnly={running}
                        />
                      </div>
                      <div className="col-4">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="auto-detect"
                          value={entry.name}
                          onChange={(e) => updateRow(i, "name", e.target.value)}
                          onPaste={(e) => handlePaste(e, i, "name")}
                          readOnly={running}
                        />
                      </div>
                      <div style={{ width: "36px" }}>
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => removeRow(i)}
                          disabled={running}
                          title="Remove"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                  {!running && (
                    <button className="btn btn-outline-secondary btn-sm mt-1" onClick={addRow}>
                      <i className="bi bi-plus-lg me-1"></i>Add another
                    </button>
                  )}
                </div>
              )}
            </div>
            {runError && (
              <div className="card-footer">
                <span className="small text-danger">
                  <i className="bi bi-exclamation-triangle me-1"></i>{runError}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Settings (col-7) + Diagnostics (col-5) side by side */}
      <div className="row mb-4">
        <div className="col-md-7 mb-4 mb-md-0">
          <div className="card shadow-sm h-100">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="bi bi-sliders me-2"></i>Settings
              </h5>
            </div>
            <div className="card-body d-flex flex-column">
              <div className="flex-fill">
                <div className="row">
                  {otherSettings.map((s) => (
                    <div key={s.key} className="col-md-6">
                      <SettingField
                        setting={s}
                        value={settings[s.key] ?? ""}
                        onChange={set(s.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <SaveBar saving={saving} message={saveMessage} onSave={handleSave} />
            </div>
          </div>
        </div>

        <div className="col-md-5">
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
    </>
  );
}
