import type { LogEntry } from "../types";

interface LogConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  height?: string;
  connectionError?: string | null;
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
  height = "400px",
  connectionError,
}: LogConsoleProps) {
  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">
          <i className="bi bi-terminal me-2"></i>Live Logs
        </h5>
        <button className="btn btn-outline-secondary btn-sm" onClick={onClear}>
          <i className="bi bi-trash me-1"></i>Clear
        </button>
      </div>
      {connectionError && (
        <div className="alert alert-warning mb-0 rounded-0 py-2 small">
          <i className="bi bi-exclamation-triangle me-1"></i>
          {connectionError}
        </div>
      )}
      <div className="card-body p-0">
        <div
          style={{
            height,
            overflowY: "auto",
            fontFamily: "'Cascadia Code', 'Fira Code', monospace",
            fontSize: "0.85rem",
            padding: "0.75rem",
            background: "#1e1e1e",
            color: "#d4d4d4",
          }}
        >
          {logs.length === 0 ? (
            <div className="text-muted fst-italic">
              No log entries. Start the script to see output.
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1">
                <span className="text-muted">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{" "}
                <span className={getLogLevelColor(log.level)}>
                  [{log.level}]
                </span>{" "}
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
