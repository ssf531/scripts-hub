import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import type { CsvRow, TransactionGroup, CategoryAssignment } from "../api/spending";
import { groupCsvs, exportExcel, categorise, categoriseQueue } from "../api/spending";
import { getAiTask, getAiTasks, type AiTask } from "../api/aiTasks";
import { getConfig } from "../api/config";

// ── Step progress bar ─────────────────────────────────────────────────────────

const STEPS = [
  { label: "Import CSV", icon: "bi-file-earmark-csv" },
  { label: "Group & Count", icon: "bi-collection" },
  { label: "Export Excel", icon: "bi-file-earmark-excel" },
  { label: "AI Analysis", icon: "bi-robot" },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="d-flex align-items-center mb-4">
      {STEPS.map((step, i) => (
        <div key={i} className="d-flex align-items-center flex-grow-1">
          <div className="d-flex flex-column align-items-center" style={{ minWidth: 72 }}>
            <div
              className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${
                i < current
                  ? "bg-success text-white"
                  : i === current
                    ? "border border-2 border-success text-success bg-white"
                    : "bg-secondary bg-opacity-25 text-secondary"
              }`}
              style={{ width: 36, height: 36, fontSize: 14 }}
            >
              {i < current ? <i className="bi bi-check-lg" /> : i + 1}
            </div>
            <small
              className={`mt-1 text-center ${i === current ? "fw-semibold text-success" : "text-muted"}`}
              style={{ fontSize: 11, lineHeight: 1.2 }}
            >
              {step.label}
            </small>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-grow-1 mx-1 ${i < current ? "bg-success" : "bg-secondary bg-opacity-25"}`}
              style={{ height: 2, marginBottom: 20 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining":        "#fd7e14",
  Transport:              "#0d6efd",
  Shopping:               "#dc3545",
  "Bills & Utilities":    "#6f42c1",
  Healthcare:             "#20c997",
  Entertainment:          "#e83e8c",
  "Savings & Transfers":  "#0dcaf0",
  Other:                  "#6c757d",
};

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "#6c757d";
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SpendingAnalysis() {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [csvFiles, setCsvFiles] = useState<File[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);

  // Step 2 state
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [grouping, setGrouping] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [mergeSelected, setMergeSelected] = useState<Set<number>>(new Set());

  // Step 4 state
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [periodLabel, setPeriodLabel] = useState("");
  const [categorising, setCategorising] = useState(false);
  const [categories, setCategories] = useState<CategoryAssignment[]>([]);
  const [rawResponse, setRawResponse] = useState("");
  const [catError, setCatError] = useState<string | null>(null);

  // Queue-based categorisation state
  const [queueTaskId, setQueueTaskId] = useState<number | null>(null);
  const [queueTask, setQueueTask] = useState<AiTask | null>(null);
  const [pollIntervalRef] = useState<{ current: ReturnType<typeof setInterval> | null }>({ current: null });
  const [completedTasks, setCompletedTasks] = useState<AiTask[]>([]);
  const [loadingCompletedTasks, setLoadingCompletedTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // ── Fetch default Ollama model from config ─────────────────────────────────

  useEffect(() => {
    getConfig().then((cfg) => setOllamaModel(cfg.defaultModel)).catch(() => {});
  }, []);

  // ── Preview CSV on file select ────────────────────────────────────────────

  useEffect(() => {
    if (csvFiles.length === 0) { setPreviewRows([]); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const header = lines[0]?.split(",") ?? [];
      const preview = lines.slice(1, 6).map((line) => {
        const parts = line.split(",");
        const get = (idx: number) => (idx >= 0 ? parts[idx]?.trim().replace(/"/g, "") ?? "" : "");
        const dateIdx = header.findIndex((h) => /date/i.test(h));
        const descIdx = header.findIndex((h) => /desc/i.test(h));
        const debitIdx = header.findIndex((h) => /debit/i.test(h));
        const creditIdx = header.findIndex((h) => /credit/i.test(h));
        return {
          date: get(dateIdx),
          description: get(descIdx),
          debit: parseFloat(get(debitIdx)) || null,
          credit: parseFloat(get(creditIdx)) || null,
          balance: null,
          sourceFile: csvFiles[0].name,
        } as CsvRow;
      });
      setPreviewRows(preview);
    };
    reader.readAsText(csvFiles[0]);
  }, [csvFiles]);

  // ── Step 2: group ─────────────────────────────────────────────────────────

  const runGroup = useCallback(async () => {
    setGrouping(true);
    setGroupError(null);
    try {
      const result = await groupCsvs(csvFiles, dateFrom || undefined, dateTo || undefined);
      setRows(result.rows);
      setGroups(result.groups);
    } catch (e: unknown) {
      setGroupError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrouping(false);
    }
  }, [csvFiles, dateFrom, dateTo]);

  useEffect(() => {
    if (step === 1 && groups.length === 0) runGroup();
  }, [step]);

  // ── Merge selected groups ─────────────────────────────────────────────────

  const handleMerge = () => {
    if (mergeSelected.size < 2) return;
    const indices = Array.from(mergeSelected).sort();
    const base = groups[indices[0]];
    const mergedRows = indices.flatMap((i) => groups[i].rows);
    const merged: TransactionGroup = {
      normalisedName: base.normalisedName,
      displayName: base.displayName,
      count: mergedRows.length,
      totalDebit: mergedRows.reduce((s, r) => s + (r.debit ?? 0), 0),
      totalCredit: mergedRows.reduce((s, r) => s + (r.credit ?? 0), 0),
      rows: mergedRows,
    };
    const newGroups = groups.filter((_, i) => !mergeSelected.has(i));
    newGroups.splice(indices[0], 0, merged);
    setGroups(newGroups);
    setMergeSelected(new Set());
  };

  // ── Step 3: export Excel ──────────────────────────────────────────────────

  const handleExportExcel = useCallback(async () => {
    try {
      await exportExcel(rows, groups);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }, [rows, groups]);

  // ── Step 4: categorise ────────────────────────────────────────────────────

  const runCategorise = useCallback(async () => {
    setCategorising(true);
    setCatError(null);
    setCategories([]);
    setRawResponse("");
    try {
      const result = await categorise(groups, ollamaModel);
      setCategories(result.categories);
      setRawResponse(result.rawResponse);
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : String(e));
    } finally {
      setCategorising(false);
    }
  }, [groups, ollamaModel]);

  const addCategoriseToQueue = useCallback(async () => {
    setCatError(null);
    setCategories([]);
    setRawResponse("");
    try {
      const result = await categoriseQueue(groups, ollamaModel);
      setQueueTaskId(result.taskId);
      setQueueTask({ id: result.taskId, status: "Pending" } as AiTask);

      // Start polling for task status
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const task = await getAiTask(result.taskId);
          setQueueTask(task);

          if (task.status === "Completed" && task.output) {
            try {
              const jsonStart = task.output.indexOf('[');
              const jsonEnd = task.output.lastIndexOf(']');
              if (jsonStart >= 0 && jsonEnd >= 0) {
                const jsonSlice = task.output.slice(jsonStart, jsonEnd + 1);
                const cats = JSON.parse(jsonSlice) as CategoryAssignment[];
                setCategories(cats);
              }
            } catch {}
            setRawResponse(task.output);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          } else if (task.status === "Failed") {
            setCatError(task.errorMessage || "Task failed");
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        } catch {}
      }, 2000);
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : String(e));
    }
  }, [groups, ollamaModel, pollIntervalRef]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [pollIntervalRef]);

  // ── Load completed categorisation tasks ──────────────────────────────────

  const loadCompletedTasks = useCallback(async () => {
    setLoadingCompletedTasks(true);
    try {
      const page = await getAiTasks({ type: "SpendingCategorisation", status: "Completed", pageSize: 10 });
      setCompletedTasks(page.items);
      setShowCompletedTasks(true);
    } catch { /* ignore */ } finally {
      setLoadingCompletedTasks(false);
    }
  }, []);

  const loadCompletedTask = useCallback(async (id: number) => {
    const task = await getAiTask(id);
    setQueueTask(task);
    setQueueTaskId(task.id);
    // Parse and display results
    if (task.output) {
      try {
        const jsonStart = task.output.indexOf('[');
        const jsonEnd = task.output.lastIndexOf(']');
        if (jsonStart >= 0 && jsonEnd >= 0) {
          const cats = JSON.parse(task.output.slice(jsonStart, jsonEnd + 1)) as CategoryAssignment[];
          setCategories(cats);
        }
      } catch { /* ignore */ }
      setRawResponse(task.output);
    }
    setShowCompletedTasks(false);
    setStep(3);
  }, []);

  // ── Category breakdown computation ───────────────────────────────────────

  const categoryBreakdown = (() => {
    if (categories.length === 0) return [];
    const catMap: Record<string, { total: number; topGroups: string[] }> = {};
    categories.forEach(({ group, category }) => {
      const grp = groups.find((g) => g.displayName === group);
      if (!grp) return;
      if (!catMap[category]) catMap[category] = { total: 0, topGroups: [] };
      catMap[category].total += grp.totalDebit;
      catMap[category].topGroups.push(group);
    });
    const totalSpend = Object.values(catMap).reduce((s, c) => s + c.total, 0);
    return Object.entries(catMap)
      .map(([cat, { total, topGroups }]) => ({
        category: cat,
        total,
        pct: totalSpend > 0 ? (total / totalSpend) * 100 : 0,
        topGroups: topGroups.slice(0, 3),
      }))
      .sort((a, b) => b.total - a.total);
  })();

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep(0);
    setCsvFiles([]);
    setRows([]);
    setGroups([]);
    setCategories([]);
    setRawResponse("");
    setCatError(null);
    setGroupError(null);
    setPreviewRows([]);
    setQueueTaskId(null);
    setQueueTask(null);
    setCompletedTasks([]);
    setShowCompletedTasks(false);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <h3 className="mb-4">
        <i className="bi bi-graph-up me-2 text-success"></i>Spending Analysis
      </h3>

      <StepBar current={step} />

      <div className="card shadow-sm">
        <div className="card-body p-4">

          {/* ── Step 1: Import CSV ──────────────────────────────────────── */}
          {step === 0 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-file-earmark-csv me-2"></i>Import CSV Files</h5>
              <p className="text-muted">
                Upload CSV files exported from the PDF Parser, or any bank statement CSV with
                Date, Description, Debit, Credit columns.
              </p>

              <div
                className="border border-2 border-dashed rounded p-5 text-center mb-3"
                style={{ borderColor: "#198754", cursor: "pointer" }}
                onClick={() => document.getElementById("csvInput")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = Array.from(e.dataTransfer.files).filter((f) =>
                    f.name.endsWith(".csv"),
                  );
                  setCsvFiles((prev) => [...prev, ...dropped]);
                }}
              >
                <i className="bi bi-cloud-upload display-4 text-success"></i>
                <p className="mt-2 mb-0 text-muted">
                  Drag & drop CSV files here, or <strong>click to browse</strong>
                </p>
                <input
                  id="csvInput"
                  type="file"
                  accept=".csv"
                  multiple
                  className="d-none"
                  onChange={(e) => {
                    setCsvFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                    e.target.value = "";
                  }}
                />
              </div>

              {csvFiles.length > 0 && (
                <ul className="list-group mb-3">
                  {csvFiles.map((f, i) => (
                    <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                      <span>
                        <i className="bi bi-file-earmark-csv text-success me-2"></i>
                        {f.name}
                        <span className="text-muted ms-2">({(f.size / 1024).toFixed(1)} KB)</span>
                      </span>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setCsvFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Date range filter */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">From Date (optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">To Date (optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview */}
              {previewRows.length > 0 && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Preview (first 5 rows)</label>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead className="table-light">
                        <tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th></tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.date}</td>
                            <td>{r.description}</td>
                            <td className="text-danger">{r.debit?.toFixed(2) ?? ""}</td>
                            <td className="text-success">{r.credit?.toFixed(2) ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Or load a past result from queue ──────────────────── */}
              <div className="text-center text-muted my-3 small">— or —</div>
              <div className="d-flex justify-content-center mb-2">
                <button
                  className="btn btn-outline-secondary"
                  onClick={loadCompletedTasks}
                  disabled={loadingCompletedTasks}
                >
                  {loadingCompletedTasks
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Loading…</>
                    : <><i className="bi bi-folder2-open me-2"></i>Load Past Analysis from Queue</>}
                </button>
              </div>
              {showCompletedTasks && (
                <div className="card mb-3 border-secondary">
                  <div className="card-header d-flex justify-content-between align-items-center py-2">
                    <span className="fw-semibold small">Recent completed categorisations</span>
                    <button className="btn-close btn-sm" onClick={() => setShowCompletedTasks(false)} />
                  </div>
                  {completedTasks.length === 0 ? (
                    <div className="card-body py-2 text-muted small">No completed categorisation tasks found.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {completedTasks.map((t) => (
                        <li key={t.id} className="list-group-item list-group-item-action py-2 d-flex justify-content-between align-items-center"
                          style={{ cursor: "pointer" }} onClick={() => loadCompletedTask(t.id)}>
                          <span>
                            <span className="badge bg-success me-2">#{t.id}</span>
                            <span className="small">{t.description}</span>
                          </span>
                          <small className="text-muted">{new Date(t.completedAt!).toLocaleString()}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="d-flex justify-content-end">
                <button
                  className="btn btn-success"
                  disabled={csvFiles.length === 0}
                  onClick={() => { setGroups([]); setStep(1); }}
                >
                  Next: Group Transactions <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Group & Count ────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-collection me-2"></i>Group &amp; Count</h5>

              {grouping && (
                <div className="text-center py-4">
                  <div className="spinner-border text-success mb-2"></div>
                  <p className="text-muted">Grouping transactions…</p>
                </div>
              )}

              {groupError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>{groupError}
                </div>
              )}

              {!grouping && groups.length > 0 && (
                <>
                  <div className="d-flex gap-3 mb-3 flex-wrap">
                    <span className="badge fs-6 bg-secondary">{rows.length} total transactions</span>
                    <span className="badge fs-6 bg-success">{groups.length} groups</span>
                    <span className="badge fs-6 bg-danger">
                      Total Spend: {groups.reduce((s, g) => s + g.totalDebit, 0).toFixed(2)}
                    </span>
                  </div>

                  {mergeSelected.size >= 2 && (
                    <button className="btn btn-sm btn-warning mb-2" onClick={handleMerge}>
                      <i className="bi bi-union me-1"></i>Merge {mergeSelected.size} selected groups
                    </button>
                  )}

                  <div className="table-responsive" style={{ maxHeight: 500 }}>
                    <table className="table table-sm table-hover table-bordered mb-0">
                      <thead className="table-dark sticky-top">
                        <tr>
                          <th style={{ width: 36 }}></th>
                          <th>Group Name</th>
                          <th className="text-center">Count</th>
                          <th className="text-end">Total Debit</th>
                          <th className="text-end">Total Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g, i) => (
                          <tr key={i}>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={mergeSelected.has(i)}
                                onChange={(e) =>
                                  setMergeSelected((prev) => {
                                    const next = new Set(prev);
                                    e.target.checked ? next.add(i) : next.delete(i);
                                    return next;
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm border-0 bg-transparent"
                                value={g.displayName}
                                onChange={(e) =>
                                  setGroups((prev) =>
                                    prev.map((gr, j) =>
                                      j === i ? { ...gr, displayName: e.target.value } : gr,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td className="text-center">{g.count}</td>
                            <td className="text-end text-danger">{g.totalDebit.toFixed(2)}</td>
                            <td className="text-end text-success">{g.totalCredit.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="d-flex justify-content-between mt-3">
                <button className="btn btn-outline-secondary" onClick={() => setStep(0)}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button
                  className="btn btn-success"
                  disabled={groups.length === 0}
                  onClick={() => setStep(2)}
                >
                  Next: Export Excel <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Export Excel ────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-file-earmark-excel me-2"></i>Export Excel</h5>
              <p className="text-muted">
                Download an Excel workbook with two sheets:
                <strong> Transactions</strong> (all raw rows) and
                <strong> Groups Summary</strong> (normalised groups with totals).
              </p>

              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="card text-center border-0 bg-light">
                    <div className="card-body">
                      <i className="bi bi-table display-5 text-primary mb-2"></i>
                      <h6>Transactions sheet</h6>
                      <p className="text-muted mb-0">{rows.length} rows</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card text-center border-0 bg-light">
                    <div className="card-body">
                      <i className="bi bi-bar-chart display-5 text-success mb-2"></i>
                      <h6>Groups Summary sheet</h6>
                      <p className="text-muted mb-0">{groups.length} groups</p>
                    </div>
                  </div>
                </div>
              </div>

              <button className="btn btn-success btn-lg" onClick={handleExportExcel}>
                <i className="bi bi-file-earmark-arrow-down me-2"></i>
                Download Excel
              </button>

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(1)}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button className="btn btn-success" onClick={() => setStep(3)}>
                  Next: AI Analysis <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Ollama Category Analysis ───────────────────────── */}
          {step === 3 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-robot me-2"></i>AI Spending Category Analysis</h5>
              <p className="text-muted">
                Ollama will categorise your spending groups into: Food & Dining, Transport, Shopping,
                Bills & Utilities, Healthcare, Entertainment, Savings & Transfers, Other.
              </p>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Ollama Model</label>
                  <input
                    type="text"
                    className="form-control"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Period Label (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Jan–Mar 2024"
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                  />
                </div>
              </div>

              <div className="d-flex gap-2 mb-4">
                <button
                  className="btn btn-success"
                  disabled={categorising || groups.length === 0}
                  onClick={runCategorise}
                >
                  {categorising ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>Analysing…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-robot me-2"></i>Analyse Spending
                    </>
                  )}
                </button>
                <button
                  className="btn btn-outline-success"
                  disabled={queueTaskId !== null || groups.length === 0}
                  onClick={addCategoriseToQueue}
                >
                  <i className="bi bi-clock-history me-2"></i>Add to Queue
                </button>
              </div>

              {catError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>{catError}
                  <div className="mt-1 small text-muted">
                    Ensure Ollama is running and model is pulled (ollama pull {ollamaModel}).
                  </div>
                </div>
              )}

              {queueTask && (
                <div className="alert alert-info mb-4">
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <i className="bi bi-info-circle me-2"></i>
                      Task #{queueTask.id}:{" "}
                      <strong>
                        {queueTask.status === "Pending" && (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>Queued
                          </>
                        )}
                        {queueTask.status === "Running" && (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>Running
                          </>
                        )}
                        {queueTask.status === "Completed" && (
                          <>
                            <i className="bi bi-check-circle me-2 text-success"></i>Completed
                          </>
                        )}
                        {queueTask.status === "Failed" && (
                          <>
                            <i className="bi bi-x-circle me-2 text-danger"></i>Failed
                          </>
                        )}
                      </strong>
                    </div>
                    <Link to="/ai-queue" className="btn btn-sm btn-outline-info">
                      View in Queue
                    </Link>
                  </div>
                </div>
              )}

              {categoryBreakdown.length > 0 && (
                <div>
                  {periodLabel && (
                    <h6 className="text-muted mb-3">
                      <i className="bi bi-calendar-range me-2"></i>Period: {periodLabel}
                    </h6>
                  )}

                  {/* Category breakdown table + bars */}
                  <div className="table-responsive mb-3">
                    <table className="table table-sm align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Category</th>
                          <th className="text-end">Total Spend</th>
                          <th>Share</th>
                          <th>Top Groups</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryBreakdown.map((row, i) => (
                          <tr key={i}>
                            <td>
                              <span
                                className="badge me-2"
                                style={{ background: catColor(row.category) }}
                              >
                                {row.category}
                              </span>
                            </td>
                            <td className="text-end fw-semibold">{row.total.toFixed(2)}</td>
                            <td style={{ minWidth: 200 }}>
                              <div className="d-flex align-items-center gap-2">
                                <div className="progress flex-grow-1" style={{ height: 12 }}>
                                  <div
                                    className="progress-bar"
                                    style={{
                                      width: `${row.pct}%`,
                                      background: catColor(row.category),
                                    }}
                                  />
                                </div>
                                <small className="text-muted">{row.pct.toFixed(1)}%</small>
                              </div>
                            </td>
                            <td className="small text-muted">{row.topGroups.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Ollama raw reasoning */}
                  <details>
                    <summary className="text-muted small mb-2" style={{ cursor: "pointer" }}>
                      Show Ollama raw response
                    </summary>
                    <pre
                      className="bg-light p-3 rounded border small"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {rawResponse}
                    </pre>
                  </details>
                </div>
              )}

              <div className="d-flex justify-content-between mt-4">
                <button className="btn btn-outline-secondary" onClick={() => setStep(2)}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button className="btn btn-outline-success" onClick={handleReset}>
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Start Over
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
