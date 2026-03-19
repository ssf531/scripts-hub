import { useState, useEffect, useCallback } from "react";
import { useLogHub } from "../hooks/useLogHub";
import type { AiTask, AiTaskPage } from "../api/aiTasks";
import { getAiTasks, getAiTask, deleteAiTask } from "../api/aiTasks";

const STATUS_COLORS: Record<string, string> = {
  Pending:   "bg-secondary",
  Running:   "bg-primary",
  Completed: "bg-success",
  Failed:    "bg-danger",
};

const STATUS_ICONS: Record<string, string> = {
  Pending:   "bi-clock",
  Running:   "bi-arrow-repeat",
  Completed: "bi-check-circle-fill",
  Failed:    "bi-x-circle-fill",
};

function duration(task: AiTask): string {
  if (!task.startedAt) return "—";
  const end = task.completedAt ? new Date(task.completedAt) : new Date();
  const secs = Math.round((end.getTime() - new Date(task.startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function AiQueue() {
  const [data, setData] = useState<AiTaskPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedTask, setExpandedTask] = useState<AiTask | null>(null);
  const [loadingExpanded, setLoadingExpanded] = useState(false);
  const [deleting, setDeleting] = useState<Set<number>>(new Set());

  useLogHub();

  const load = useCallback(async () => {
    try {
      const result = await getAiTasks({
        status: statusFilter || undefined,
        type:   typeFilter || undefined,
        pageSize: 100,
      });
      setData(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any task is Running or Pending
  useEffect(() => {
    // Poll every 5s while any task is Running or Pending
    const hasActive = data?.items.some(t => t.status === "Pending" || t.status === "Running");
    if (!hasActive) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [data, load]);

  const handleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedTask(null);
      return;
    }
    setExpandedId(id);
    setLoadingExpanded(true);
    try {
      const task = await getAiTask(id);
      setExpandedTask(task);
    } catch {
      setExpandedTask(null);
    } finally {
      setLoadingExpanded(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting((prev) => new Set(prev).add(id));
    try {
      await deleteAiTask(id);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.filter((t) => t.id !== id), total: prev.total - 1 } : prev,
      );
      if (expandedId === id) { setExpandedId(null); setExpandedTask(null); }
    } catch {
      /* ignore */
    } finally {
      setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const activeCount = data?.items.filter(t => t.status === "Pending" || t.status === "Running").length ?? 0;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h3 className="mb-0">
          <i className="bi bi-cpu me-2"></i>AI Task Queue
          {activeCount > 0 && (
            <span className="badge bg-primary ms-2 fs-6">{activeCount} active</span>
          )}
        </h3>
        <button className="btn btn-sm btn-outline-secondary" onClick={load}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="d-flex gap-2 mb-3">
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {["Pending", "Running", "Completed", "Failed"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 200 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {Array.from(new Set(data?.items.map((t) => t.type) ?? [])).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(statusFilter || typeFilter) && (
          <button className="btn btn-sm btn-outline-secondary" onClick={() => { setStatusFilter(""); setTypeFilter(""); }}>
            <i className="bi bi-x me-1"></i>Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No AI tasks yet. Tasks are created when you run validations or AI-powered scripts.
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span className="fw-semibold">{data.total} task{data.total !== 1 ? "s" : ""}</span>
            <small className="text-muted">Click a row to view prompt &amp; output</small>
          </div>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Duration</th>
                  <th style={{ width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((task) => (
                  <>
                    <tr
                      key={task.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleExpand(task.id)}
                      className={expandedId === task.id ? "table-active" : ""}
                    >
                      <td className="text-muted">{task.id}</td>
                      <td><span className="badge bg-secondary">{task.type}</span></td>
                      <td>{task.description}</td>
                      <td><code>{task.model}</code></td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[task.status] ?? "bg-secondary"}`}>
                          <i className={`bi ${STATUS_ICONS[task.status] ?? "bi-circle"} me-1${task.status === "Running" ? " spin" : ""}`}></i>
                          {task.status}
                        </span>
                      </td>
                      <td className="text-nowrap small text-muted">{formatDate(task.createdAt)}</td>
                      <td className="text-nowrap small">{duration(task)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          disabled={deleting.has(task.id) || task.status === "Running"}
                          onClick={() => handleDelete(task.id)}
                          title={task.status === "Running" ? "Cannot delete a running task" : "Delete"}
                        >
                          {deleting.has(task.id)
                            ? <span className="spinner-border spinner-border-sm"></span>
                            : <i className="bi bi-trash"></i>}
                        </button>
                      </td>
                    </tr>
                    {expandedId === task.id && (
                      <tr key={`${task.id}-detail`}>
                        <td colSpan={8} className="p-0">
                          <div className="p-3 bg-light border-top">
                            {loadingExpanded ? (
                              <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary"></div></div>
                            ) : expandedTask ? (
                              <>
                                {expandedTask.errorMessage && (
                                  <div className="alert alert-danger py-2 mb-2">
                                    <i className="bi bi-x-circle me-1"></i>{expandedTask.errorMessage}
                                  </div>
                                )}
                                {expandedTask.output && (
                                  <div className="mb-2">
                                    <div className="fw-semibold mb-1 small text-muted text-uppercase">Output</div>
                                    <pre className="bg-white border rounded p-3 mb-0" style={{ whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 400, overflow: "auto" }}>
                                      {expandedTask.output}
                                    </pre>
                                  </div>
                                )}
                                <details>
                                  <summary className="small text-muted" style={{ cursor: "pointer" }}>Show prompt</summary>
                                  <pre className="bg-white border rounded p-3 mt-1 mb-0" style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 300, overflow: "auto" }}>
                                    {expandedTask.prompt}
                                  </pre>
                                </details>
                              </>
                            ) : (
                              <span className="text-muted small">No details available.</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
