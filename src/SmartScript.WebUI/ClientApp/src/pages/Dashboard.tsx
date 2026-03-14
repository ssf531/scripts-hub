import { useEffect, useState, useCallback } from "react";
import type { ScriptInfo } from "../types";
import {
  getScripts,
  getSuccessRates,
  runScript,
  stopScript,
} from "../api/scripts";
import { ScriptCard } from "../components/ScriptCard";

export function Dashboard() {
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [successRates, setSuccessRates] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const [scriptList, rates] = await Promise.all([
      getScripts(),
      getSuccessRates(),
    ]);
    setScripts(scriptList);
    setSuccessRates(rates);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStart = async (name: string) => {
    setProcessing((prev) => new Set(prev).add(name));
    setScripts((prev) =>
      prev.map((s) => (s.name === name ? { ...s, state: "running" } : s)),
    );

    try {
      const result = await runScript(name);
      setScripts((prev) =>
        prev.map((s) => (s.name === name ? { ...s, state: result.state } : s)),
      );
    } catch {
      setScripts((prev) =>
        prev.map((s) => (s.name === name ? { ...s, state: "error" } : s)),
      );
    }

    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });

    // Refresh success rates
    try {
      const rates = await getSuccessRates();
      setSuccessRates(rates);
    } catch {
      /* ignore */
    }
  };

  const handleStop = async (name: string) => {
    try {
      const result = await stopScript(name);
      setScripts((prev) =>
        prev.map((s) => (s.name === name ? { ...s, state: result.state } : s)),
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <h3 className="mb-4">
        <i className="bi bi-grid-1x2-fill me-2"></i>Script Dashboard
      </h3>

      {scripts.length === 0 ? (
        <div className="alert alert-info">
          No scripts loaded. Make sure at least one script plugin is available.
        </div>
      ) : (
        <div className="row g-4 mb-4">
          {scripts.map((script) => (
            <div key={script.name} className="col-md-6 col-lg-4">
              <ScriptCard
                script={script}
                successRate={successRates[script.name]}
                onStart={() => handleStart(script.name)}
                onStop={() => handleStop(script.name)}
                isProcessing={processing.has(script.name)}
              />
            </div>
          ))}
        </div>
      )}

    </>
  );
}
