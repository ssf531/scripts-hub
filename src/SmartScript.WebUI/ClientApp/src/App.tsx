import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { LogConsole } from "./components/LogConsole";
import { useLogHub } from "./hooks/useLogHub";

export function App() {
  const [collapsed, setCollapsed] = useState(true);
  const { logs, clearLogs, connectionError } = useLogHub();

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <Navbar />
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <main
          className="flex-grow-1 p-4 overflow-auto"
          style={{ background: "#f8f9fa" }}
        >
          <Outlet />
        </main>
        <LogConsole
          logs={logs}
          onClear={clearLogs}
          connectionError={connectionError}
          collapsed={collapsed}
          onToggle={() => setCollapsed((prev) => !prev)}
        />
      </div>
    </div>
  );
}
