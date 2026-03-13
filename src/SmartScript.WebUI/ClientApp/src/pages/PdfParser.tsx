import { useState, useCallback, useEffect } from "react";
import type {
  ColumnDef,
  ColumnLayout,
  BankTransaction,
  ParsedFile,
  PreviewRow,
} from "../api/pdf";
import {
  detectLayout,
  previewLayout,
  parsePdfs,
  validateTransactions,
  exportCsv,
} from "../api/pdf";

// ── Step progress bar ─────────────────────────────────────────────────────────

const STEPS = [
  { label: "Upload", icon: "bi-upload" },
  { label: "Detect Layout", icon: "bi-layout-three-columns" },
  { label: "Preview", icon: "bi-eye" },
  { label: "Transactions", icon: "bi-table" },
  { label: "Validate", icon: "bi-shield-check" },
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
                  ? "bg-primary text-white"
                  : i === current
                    ? "border border-2 border-primary text-primary bg-white"
                    : "bg-secondary bg-opacity-25 text-secondary"
              }`}
              style={{ width: 36, height: 36, fontSize: 14 }}
            >
              {i < current ? <i className="bi bi-check-lg" /> : i + 1}
            </div>
            <small
              className={`mt-1 text-center ${i === current ? "fw-semibold text-primary" : "text-muted"}`}
              style={{ fontSize: 11, lineHeight: 1.2 }}
            >
              {step.label}
            </small>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-grow-1 mx-1 ${i < current ? "bg-primary" : "bg-secondary bg-opacity-25"}`}
              style={{ height: 2, marginBottom: 20 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Column colour mapping ─────────────────────────────────────────────────────

const COLUMN_COLORS: Record<string, string> = {
  Date: "#0d6efd",
  Description: "#198754",
  Debit: "#fd7e14",
  Credit: "#0dcaf0",
  Balance: "#6f42c1",
};

function colColor(name: string) {
  return COLUMN_COLORS[name] ?? "#6c757d";
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PdfParser() {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [files, setFiles] = useState<File[]>([]);

  // Step 2 state
  const [layout, setLayout] = useState<ColumnLayout | null>(null);
  const [detectingLayout, setDetectingLayout] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Step 3 state
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Step 4 state
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [exportColumns, setExportColumns] = useState<string[]>([
    "Date", "Description", "Debit", "Credit", "Balance", "SourceFile",
  ]);

  // Step 5 state
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);

  // All merged transactions
  const allTransactions: BankTransaction[] = parsedFiles.flatMap((f) => f.transactions);

  // ── Step 2: auto-detect layout when entering step 2 ──────────────────────

  useEffect(() => {
    if (step === 1 && files.length > 0 && !layout) {
      runDetectLayout();
    }
  }, [step]);

  const runDetectLayout = useCallback(async () => {
    setDetectingLayout(true);
    setDetectError(null);
    try {
      const detected = await detectLayout(files[0]);
      setLayout(detected);
    } catch (e: unknown) {
      setDetectError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetectingLayout(false);
    }
  }, [files]);

  // ── Step 3: auto-preview when entering step 3 ────────────────────────────

  useEffect(() => {
    if (step === 2 && files.length > 0 && layout) {
      runPreview();
    }
  }, [step]);

  const runPreview = useCallback(async () => {
    if (!layout) return;
    setPreviewing(true);
    setPreviewError(null);
    setPreviewRows([]);
    try {
      const rows = await previewLayout(files[0], layout);
      setPreviewRows(rows);
    } catch (e: unknown) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewing(false);
    }
  }, [files, layout]);

  // ── Step 4: auto-parse when entering step 4 ──────────────────────────────

  useEffect(() => {
    if (step === 3 && files.length > 0 && layout && parsedFiles.length === 0) {
      runParse();
    }
  }, [step]);

  const runParse = useCallback(async () => {
    if (!layout) return;
    setParsing(true);
    setParseError(null);
    try {
      const results = await parsePdfs(files, layout);
      setParsedFiles(results);
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }, [files, layout]);

  // ── Step 5: validate ──────────────────────────────────────────────────────

  const runValidate = useCallback(async () => {
    if (parsedFiles.length === 0) return;
    const target = parsedFiles[selectedFileIdx];
    setValidating(true);
    setValidateError(null);
    setValidationReport(null);
    try {
      const result = await validateTransactions(target.transactions, target.rawText, ollamaModel);
      setValidationReport(result.report);
    } catch (e: unknown) {
      setValidateError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  }, [parsedFiles, selectedFileIdx, ollamaModel]);

  // ── Export CSV ────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      await exportCsv(allTransactions, exportColumns);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }, [allTransactions, exportColumns]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep(0);
    setFiles([]);
    setLayout(null);
    setPreviewRows([]);
    setParsedFiles([]);
    setValidationReport(null);
    setValidateError(null);
    setDetectError(null);
    setPreviewError(null);
    setParseError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <h3 className="mb-4">
        <i className="bi bi-file-earmark-pdf-fill me-2 text-danger"></i>PDF Bank Statement Parser
      </h3>

      <StepBar current={step} />

      <div className="card shadow-sm">
        <div className="card-body p-4">

          {/* ── Step 1: Upload ──────────────────────────────────────────── */}
          {step === 0 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-upload me-2"></i>Upload PDF Files</h5>
              <div
                className="border border-2 border-dashed rounded p-5 text-center mb-3"
                style={{ borderColor: "#0d6efd", cursor: "pointer" }}
                onClick={() => document.getElementById("pdfInput")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = Array.from(e.dataTransfer.files).filter((f) =>
                    f.name.endsWith(".pdf"),
                  );
                  setFiles((prev) => [...prev, ...dropped]);
                }}
              >
                <i className="bi bi-cloud-upload display-4 text-primary"></i>
                <p className="mt-2 mb-0 text-muted">
                  Drag & drop PDF files here, or <strong>click to browse</strong>
                </p>
                <small className="text-muted">Supports multiple bank statement PDFs</small>
                <input
                  id="pdfInput"
                  type="file"
                  accept=".pdf"
                  multiple
                  className="d-none"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    setFiles((prev) => [...prev, ...selected]);
                    e.target.value = "";
                  }}
                />
              </div>

              {files.length > 0 && (
                <ul className="list-group mb-3">
                  {files.map((f, i) => (
                    <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                      <span>
                        <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                        {f.name}
                        <span className="text-muted ms-2">({(f.size / 1024).toFixed(1)} KB)</span>
                      </span>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="d-flex justify-content-end">
                <button
                  className="btn btn-primary"
                  disabled={files.length === 0}
                  onClick={() => setStep(1)}
                >
                  Next: Detect Layout <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Detect Layout ───────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-layout-three-columns me-2"></i>Detected Column Layout</h5>

              {detectingLayout && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary mb-2"></div>
                  <p className="text-muted">Analysing PDF layout…</p>
                </div>
              )}

              {detectError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>{detectError}
                </div>
              )}

              {layout && !detectingLayout && (
                <>
                  {/* Visual column map */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Column Map (% of page width)</label>
                    <div className="rounded overflow-hidden d-flex" style={{ height: 40, border: "1px solid #dee2e6" }}>
                      {layout.pageWidth > 0
                        ? layout.columns.map((col, i) => (
                            <div
                              key={i}
                              title={`${col.name}: ${col.xMin.toFixed(0)}–${col.xMax.toFixed(0)}`}
                              style={{
                                width: `${((col.xMax - col.xMin) / layout.pageWidth) * 100}%`,
                                background: colColor(col.name),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {col.name}
                            </div>
                          ))
                        : <div className="text-muted p-2">No columns detected</div>}
                    </div>
                  </div>

                  {/* Editable column table */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Edit Column Ranges</label>
                    <table className="table table-sm table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>Column Name</th>
                          <th>X Min</th>
                          <th>X Max</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {layout.columns.map((col, i) => (
                          <tr key={i}>
                            <td>
                              <span
                                className="badge"
                                style={{ background: colColor(col.name) }}
                              >
                                {col.name}
                              </span>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={col.xMin.toFixed(1)}
                                onChange={(e) =>
                                  setLayout((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          columns: prev.columns.map((c, j) =>
                                            j === i
                                              ? { ...c, xMin: parseFloat(e.target.value) || 0 }
                                              : c,
                                          ),
                                        }
                                      : prev,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={col.xMax.toFixed(1)}
                                onChange={(e) =>
                                  setLayout((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          columns: prev.columns.map((c, j) =>
                                            j === i
                                              ? { ...c, xMax: parseFloat(e.target.value) || 0 }
                                              : c,
                                          ),
                                        }
                                      : prev,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() =>
                                  setLayout((prev) =>
                                    prev
                                      ? { ...prev, columns: prev.columns.filter((_, j) => j !== i) }
                                      : prev,
                                  )
                                }
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() =>
                        setLayout((prev) =>
                          prev
                            ? {
                                ...prev,
                                columns: [
                                  ...prev.columns,
                                  { name: "NewColumn", xMin: 0, xMax: 50 },
                                ],
                              }
                            : prev,
                        )
                      }
                    >
                      <i className="bi bi-plus-lg me-1"></i>Add Column
                    </button>
                    <button className="btn btn-sm btn-outline-primary" onClick={runDetectLayout}>
                      <i className="bi bi-arrow-clockwise me-1"></i>Re-detect
                    </button>
                  </div>

                  {layout.columns.length === 0 && (
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      No columns were detected automatically. Please add columns manually or check that
                      the PDF header row contains keywords like DATE, DESCRIPTION, DEBIT, CREDIT, BALANCE.
                    </div>
                  )}
                </>
              )}

              <div className="d-flex justify-content-between mt-3">
                <button className="btn btn-outline-secondary" onClick={() => setStep(0)}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!layout || layout.columns.length === 0}
                  onClick={() => { setPreviewRows([]); setStep(2); }}
                >
                  Next: Preview Layout <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ─────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-eye me-2"></i>Preview & Confirm Layout</h5>
              <p className="text-muted">
                Showing the first 5 data rows from <strong>{files[0]?.name}</strong>. Each word is
                colour-coded by its detected column. Verify the layout is correct before parsing all files.
              </p>

              {previewing && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary mb-2"></div>
                  <p className="text-muted">Extracting preview rows…</p>
                </div>
              )}

              {previewError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>{previewError}
                </div>
              )}

              {previewRows.length > 0 && !previewing && (
                <>
                  <div className="mb-3">
                    {/* Column legend */}
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {layout?.columns.map((col, i) => (
                        <span key={i} className="badge" style={{ background: colColor(col.name) }}>
                          {col.name}
                        </span>
                      ))}
                      <span className="badge bg-secondary">Unknown</span>
                    </div>

                    {/* Preview rows */}
                    {previewRows.map((row, ri) => (
                      <div key={ri} className="mb-2 p-2 border rounded d-flex flex-wrap gap-1">
                        {row.words.map((w, wi) => (
                          <span
                            key={wi}
                            className="px-2 py-1 rounded small"
                            style={{ background: w.color + "22", border: `1px solid ${w.color}`, color: w.color }}
                            title={w.columnName}
                          >
                            {w.text}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="alert alert-success">
                    <i className="bi bi-check-circle me-2"></i>
                    Layout looks correct? Click <strong>Parse All Statements</strong> to continue.
                    If something looks wrong, go back and adjust the column ranges.
                  </div>
                </>
              )}

              {previewRows.length === 0 && !previewing && !previewError && (
                <div className="alert alert-warning">
                  <i className="bi bi-info-circle me-2"></i>
                  No data rows found in the preview. The layout may not match the PDF structure.
                </div>
              )}

              <div className="d-flex justify-content-between mt-3">
                <button className="btn btn-outline-secondary" onClick={() => setStep(1)}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary" onClick={runPreview} disabled={previewing}>
                    <i className="bi bi-arrow-clockwise me-1"></i>Re-run Preview
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={previewing}
                    onClick={() => { setParsedFiles([]); setStep(3); }}
                  >
                    Parse All Statements <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Transactions + Export ──────────────────────────── */}
          {step === 3 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-table me-2"></i>Parsed Transactions &amp; Export</h5>

              {parsing && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary mb-2"></div>
                  <p className="text-muted">Parsing {files.length} file(s)…</p>
                </div>
              )}

              {parseError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>{parseError}
                  <button className="btn btn-sm btn-outline-danger ms-2" onClick={runParse}>Retry</button>
                </div>
              )}

              {!parsing && parsedFiles.length > 0 && (
                <>
                  {/* Summary badges */}
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    <span className="badge fs-6 bg-primary">
                      {allTransactions.length} transactions
                    </span>
                    <span className="badge fs-6 bg-danger">
                      Total Debit: {allTransactions.reduce((s, t) => s + (t.debit ?? 0), 0).toFixed(2)}
                    </span>
                    <span className="badge fs-6 bg-success">
                      Total Credit: {allTransactions.reduce((s, t) => s + (t.credit ?? 0), 0).toFixed(2)}
                    </span>
                    {parsedFiles.map((f, i) => (
                      <span key={i} className="badge fs-6 bg-secondary">
                        {f.filename}: {f.transactions.length} rows
                      </span>
                    ))}
                  </div>

                  {/* Scrollable table */}
                  <div className="table-responsive mb-4" style={{ maxHeight: 500 }}>
                    <table className="table table-sm table-hover table-bordered mb-0">
                      <thead className="table-dark sticky-top">
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th className="text-end">Debit</th>
                          <th className="text-end">Credit</th>
                          <th className="text-end">Balance</th>
                          <th>Source File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-4">
                              No transactions parsed. Check the column layout.
                            </td>
                          </tr>
                        ) : (
                          allTransactions.map((tx, i) => (
                            <tr key={i}>
                              <td className="text-nowrap">{tx.date}</td>
                              <td>{tx.description}</td>
                              <td className="text-end text-danger">
                                {tx.debit != null ? tx.debit.toFixed(2) : ""}
                              </td>
                              <td className="text-end text-success">
                                {tx.credit != null ? tx.credit.toFixed(2) : ""}
                              </td>
                              <td className="text-end">{tx.balance != null ? tx.balance.toFixed(2) : ""}</td>
                              <td className="text-muted small">{tx.sourceFile}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Export section */}
                  <div className="border rounded p-3 bg-light">
                    <h6 className="mb-2"><i className="bi bi-download me-2"></i>Export CSV</h6>
                    <div className="mb-2 d-flex flex-wrap gap-2">
                      {["Date", "Description", "Debit", "Credit", "Balance", "SourceFile"].map((col) => (
                        <div key={col} className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`col-${col}`}
                            checked={exportColumns.includes(col)}
                            onChange={(e) =>
                              setExportColumns((prev) =>
                                e.target.checked ? [...prev, col] : prev.filter((c) => c !== col),
                              )
                            }
                          />
                          <label className="form-check-label" htmlFor={`col-${col}`}>
                            {col}
                          </label>
                        </div>
                      ))}
                    </div>
                    <button
                      className="btn btn-success"
                      disabled={allTransactions.length === 0}
                      onClick={handleExport}
                    >
                      <i className="bi bi-file-earmark-arrow-down me-2"></i>
                      Download CSV ({allTransactions.length} rows)
                    </button>
                  </div>
                </>
              )}

              <div className="d-flex justify-content-between mt-3">
                <button className="btn btn-outline-secondary" onClick={() => setStep(2)}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button
                  className="btn btn-primary"
                  disabled={allTransactions.length === 0}
                  onClick={() => setStep(4)}
                >
                  Next: Validate <i className="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Validate with Ollama ────────────────────────────── */}
          {step === 4 && (
            <div>
              <h5 className="mb-3"><i className="bi bi-shield-check me-2"></i>Validate with Ollama</h5>
              <p className="text-muted">
                Ollama will compare the raw PDF text against the parsed transactions and report any
                discrepancies.
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
                  <label className="form-label fw-semibold">File to Validate</label>
                  <select
                    className="form-select"
                    value={selectedFileIdx}
                    onChange={(e) => setSelectedFileIdx(parseInt(e.target.value))}
                  >
                    {parsedFiles.map((f, i) => (
                      <option key={i} value={i}>
                        {f.filename} ({f.transactions.length} transactions)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary mb-3"
                disabled={validating || parsedFiles.length === 0}
                onClick={runValidate}
              >
                {validating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>Validating…
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-check me-2"></i>Run Validation
                  </>
                )}
              </button>

              {validateError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {validateError}
                  <div className="mt-1 small text-muted">
                    Ensure Ollama is running and the model is pulled (ollama pull {ollamaModel}).
                  </div>
                </div>
              )}

              {validationReport && (
                <div>
                  {/* Status badge */}
                  <div className="mb-2">
                    {/discrepan|mismatch|error|missing|incorrect/i.test(validationReport) ? (
                      <span className="badge bg-warning text-dark fs-6">
                        <i className="bi bi-exclamation-triangle me-1"></i>Issues Found
                      </span>
                    ) : (
                      <span className="badge bg-success fs-6">
                        <i className="bi bi-check-circle me-1"></i>Valid
                      </span>
                    )}
                  </div>
                  <pre
                    className="bg-light p-3 rounded border"
                    style={{ whiteSpace: "pre-wrap", fontSize: 13 }}
                  >
                    {validationReport}
                  </pre>
                </div>
              )}

              <div className="d-flex justify-content-between mt-3">
                <button className="btn btn-outline-secondary" onClick={() => setStep(3)}>
                  <i className="bi bi-arrow-left me-1"></i>Back
                </button>
                <button className="btn btn-outline-primary" onClick={handleReset}>
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
