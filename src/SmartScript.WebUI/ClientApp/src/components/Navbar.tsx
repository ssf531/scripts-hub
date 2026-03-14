import { NavLink } from "react-router-dom";

interface NavbarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Navbar({ collapsed, onToggle }: NavbarProps) {
  return (
    <div
      className="d-flex flex-column bg-dark text-white transition"
      style={{
        width: collapsed ? "60px" : "250px",
        minHeight: "100vh",
        transitionProperty: "width",
        transitionDuration: "0.3s",
        transitionTimingFunction: "ease-in-out",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div className="p-3 border-bottom border-secondary d-flex align-items-center justify-content-between">
        {!collapsed && (
          <span className="fs-5 fw-semibold">
            <i className="bi bi-lightning-charge-fill me-2"></i>SmartScript Hub
          </span>
        )}
        <button
          className="btn btn-dark btn-sm p-0"
          onClick={onToggle}
          title={collapsed ? "Expand" : "Collapse"}
          style={{ width: "32px", height: "32px" }}
        >
          <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`}></i>
        </button>
      </div>

      <nav className="nav flex-column p-2" style={{ whiteSpace: collapsed ? "nowrap" : "normal" }}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "Dashboard" : undefined}
        >
          <i className="bi bi-grid-1x2-fill me-2"></i>
          {!collapsed && "Dashboard"}
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "History" : undefined}
        >
          <i className="bi bi-clock-history me-2"></i>
          {!collapsed && "History"}
        </NavLink>
        <NavLink
          to="/m3u8-downloader"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "M3U8 Downloader" : undefined}
        >
          <i className="bi bi-cloud-arrow-down me-2"></i>
          {!collapsed && "M3U8 Downloader"}
        </NavLink>
        <NavLink
          to="/pdf-parser"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "PDF Parser" : undefined}
        >
          <i className="bi bi-file-earmark-pdf-fill me-2"></i>
          {!collapsed && "PDF Parser"}
        </NavLink>
        <NavLink
          to="/spending-analysis"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "Spending Analysis" : undefined}
        >
          <i className="bi bi-graph-up me-2"></i>
          {!collapsed && "Spending Analysis"}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `nav-link text-white ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "Settings" : undefined}
        >
          <i className="bi bi-gear-fill me-2"></i>
          {!collapsed && "Settings"}
        </NavLink>
      </nav>

      {!collapsed && (
        <div className="mt-auto p-3 border-top border-secondary">
          <small className="text-muted">SmartScript Hub v1.0</small>
        </div>
      )}
    </div>
  );
}
