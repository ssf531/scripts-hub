import { Link } from "react-router-dom";
import type { ScriptInfo } from "../types";

interface ScriptCardProps {
  script: ScriptInfo;
  successRate?: number;
  onStart: () => void;
  onStop: () => void;
  isProcessing: boolean;
}

function getStateBadgeClass(state: string): string {
  switch (state) {
    case "running":
      return "bg-success";
    case "stopped":
      return "bg-warning text-dark";
    case "error":
      return "bg-danger";
    default:
      return "bg-secondary";
  }
}

export function ScriptCard({
  script,
  successRate,
  onStart,
  onStop,
  isProcessing,
}: ScriptCardProps) {
  const isRunning = script.state === "running";

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h5 className="card-title mb-0">
            <i className={`bi ${script.icon} me-2`}></i>
            <Link
              to={`/script/${encodeURIComponent(script.name)}`}
              className="text-decoration-none"
            >
              {script.name}
            </Link>
          </h5>
          <span className={`badge ${getStateBadgeClass(script.state)}`}>
            {script.state}
          </span>
        </div>

        <p className="card-text text-muted small flex-grow-1">
          {script.description}
        </p>

        {successRate !== undefined && (
          <div className="mb-2">
            <div className="d-flex justify-content-between small text-muted mb-1">
              <span>Success Rate</span>
              <span>{successRate.toFixed(0)}%</span>
            </div>
            <div className="progress" style={{ height: "4px" }}>
              <div
                className={`progress-bar ${successRate >= 80 ? "bg-success" : successRate >= 50 ? "bg-warning" : "bg-danger"}`}
                style={{ width: `${successRate}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="d-flex gap-2 mt-2">
          <div className="text-muted small">
            v{script.version} by {script.author}
          </div>
          <div className="ms-auto d-flex gap-1">
            {isRunning ? (
              <button
                className="btn btn-warning btn-sm"
                onClick={onStop}
                disabled={isProcessing}
              >
                <i className="bi bi-stop-fill me-1"></i>Stop
              </button>
            ) : (
              <button
                className="btn btn-success btn-sm"
                onClick={onStart}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                ) : (
                  <i className="bi bi-play-fill me-1"></i>
                )}
                Start
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
