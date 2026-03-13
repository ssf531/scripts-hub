import { useEffect, useState } from "react";
import type { ScriptRunRecord } from "../types";
import { getRecentRuns } from "../api/history";

export function History() {
  const [runs, setRuns] = useState<ScriptRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getRecentRuns(100)
      .then((data) => {
        if (mounted) {
          setRuns(data);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(String(err));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <h3 className="mb-4">
        <i className="bi bi-clock-history me-2"></i>Recent Script Runs
      </h3>

      {loading && (
        <div className="alert alert-info">
          <span className="spinner-border spinner-border-sm me-2"></span>
          Loading recent runs...
        </div>
      )}

      {error && !loading && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Failed to load history: {error}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="alert alert-info">
          No script runs recorded yet. Start a script from the Dashboard to see history here.
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="card shadow-sm">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="bi bi-list-check me-2"></i>Last {runs.length} Runs
            </h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Script</th>
                    <th scope="col">Started</th>
                    <th scope="col">Completed</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Status</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const started = new Date(run.startedAt);
                    const completed = run.completedAt
                      ? new Date(run.completedAt)
                      : null;

                    let durationText = "-";
                    if (completed) {
                      const ms = completed.getTime() - started.getTime();
                      const seconds = Math.round(ms / 1000);
                      if (seconds < 60) {
                        durationText = `${seconds}s`;
                      } else {
                        const minutes = Math.floor(seconds / 60);
                        const remSeconds = seconds % 60;
                        durationText = `${minutes}m ${remSeconds}s`;
                      }
                    }

                    return (
                      <tr key={run.id}>
                        <td>{run.id}</td>
                        <td>
                          <code>{run.scriptName}</code>
                        </td>
                        <td>{started.toLocaleString()}</td>
                        <td>{completed ? completed.toLocaleString() : "—"}</td>
                        <td>{durationText}</td>
                        <td>
                          <span
                            className={
                              run.success
                                ? "badge bg-success"
                                : "badge bg-danger"
                            }
                          >
                            {run.success ? "Success" : "Failed"}
                          </span>
                        </td>
                        <td style={{ maxWidth: "320px" }}>
                          <span className="text-truncate d-inline-block" style={{ maxWidth: "100%" }}>
                            {run.resultMessage}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

