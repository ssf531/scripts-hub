import { useEffect, useRef } from "react";
import type { LogEntry } from "../types";

interface LogConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  connectionError?: string | null;
  collapsed: boolean;
  onToggle: () => void;
}

function getLogLevelColor(level: string): string {
  switch (String(level).toLowerCase()) {
    case "error":
      return "text-danger fw-bold";
    case "warning":
      return "text-warning";
    case "info":
      return "text-info";
    default:
      return "";
  }
}

export function LogConsole({
  logs,
  onClear,
  connectionError,
  collapsed,
  onToggle,
}: LogConsoleProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, collapsed]);

  const errorCount = logs.filter((l) => l.level.toLowerCase() === "error").length;

  return (
    <div
      style={{
        borderTop: "2px solid #333",
        background: "#1e1e1e",
        flexShrink: 0,
        height: collapsed ? "40px" : "260px",
        transition: "height 0.2s ease",
        overflow: "hidden",
      }}
    >
      {/* Toggle bar */}
      <div
        className="d-flex align-items-center gap-2 px-3"
        style={{ height: "40px", cursor: "pointer", userSelect: "none" }}
        onClick={onToggle}
      >
        <i className="bi bi-terminal text-secondary"></i>
        <span className="text-light small fw-semibold">Live Logs</span>
        {logs.length > 0 && (
          <span
            className={`badge ${errorCount > 0 ? "bg-danger" : "bg-secondary"} ms-1`}
          >
            {logs.length}
          </span>
        )}
        {connectionError && (
          <span className="badge bg-warning text-dark ms-1">disconnected</span>
        )}
        <span className="ms-auto d-flex align-items-center gap-3">
          {!collapsed && (
            <button
              className="btn btn-link btn-sm text-secondary p-0"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Clear logs"
            >
              <i className="bi bi-trash"></i>
            </button>
          )}
          <i
            className={`bi ${collapsed ? "bi-chevron-up" : "bi-chevron-down"} text-secondary`}
          ></i>
        </span>
      </div>

      {/* Log body */}
      <div
        ref={bodyRef}
        style={{
          height: "220px",
          overflowY: "auto",
          fontFamily: "'Cascadia Code', 'Fira Code', monospace",
          fontSize: "0.82rem",
          padding: "0.4rem 0.75rem",
          color: "#d4d4d4",
        }}
      >
        {connectionError && (
          <div className="text-warning mb-1 small">
            <i className="bi bi-exclamation-triangle me-1"></i>
            {connectionError}
          </div>
        )}
        {logs.length === 0 ? (
          <span className="text-muted fst-italic">
            No log entries yet. Run a script to see output.
          </span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-1">
              <span style={{ color: "#858585" }}>
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>{" "}
              <span className={getLogLevelColor(log.level)}>[{log.level}]</span>{" "}
              {log.scriptName && (
                <span style={{ color: "#569cd6" }}>[{log.scriptName}]</span>
              )}{" "}
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
