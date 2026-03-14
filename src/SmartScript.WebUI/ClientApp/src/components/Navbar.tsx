import { NavLink } from "react-router-dom";

export function Navbar() {
  return (
    <div
      className="d-flex flex-column bg-dark text-white"
      style={{ width: "250px", minHeight: "100vh" }}
    >
      <div className="p-3 border-bottom border-secondary">
        <span className="fs-5 fw-semibold">
          <i className="bi bi-lightning-charge-fill me-2"></i>SmartScript Hub
        </span>
      </div>

      <nav className="nav flex-column p-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
        >
          <i className="bi bi-grid-1x2-fill me-2"></i>Dashboard
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
        >
          <i className="bi bi-clock-history me-2"></i>History
        </NavLink>
        <NavLink
          to="/m3u8-downloader"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
        >
          <i className="bi bi-cloud-arrow-down me-2"></i>M3U8 Downloader
        </NavLink>
        <NavLink
          to="/pdf-parser"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
        >
          <i className="bi bi-file-earmark-pdf-fill me-2"></i>PDF Parser
        </NavLink>
        <NavLink
          to="/spending-analysis"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
        >
          <i className="bi bi-graph-up me-2"></i>Spending Analysis
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
        >
          <i className="bi bi-gear-fill me-2"></i>Settings
        </NavLink>
      </nav>

      <div className="mt-auto p-3 border-top border-secondary">
        <small className="text-muted">SmartScript Hub v1.0</small>
      </div>
    </div>
  );
}
