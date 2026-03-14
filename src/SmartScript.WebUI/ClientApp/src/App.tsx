import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { LogConsole } from "./components/LogConsole";
import { useLogHub } from "./hooks/useLogHub";

export function App() {
  const [logCollapsed, setLogCollapsed] = useState(true);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const { logs, clearLogs, connectionError } = useLogHub();

  return (
    <div className="d-flex" style={{ height: "100vh" }}>
      <Navbar collapsed={navCollapsed} onToggle={() => setNavCollapsed((prev) => !prev)} />
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
          collapsed={logCollapsed}
          onToggle={() => setLogCollapsed((prev) => !prev)}
        />
      </div>
    </div>
  );
}
