import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

interface NavbarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Navbar({ collapsed, onToggle }: NavbarProps) {
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const small = window.innerWidth < 768;
      setIsSmallScreen(small);
      // Auto-collapse on small screens, auto-expand on large screens
      if (small && !collapsed) {
        onToggle();
      } else if (!small && collapsed) {
        onToggle();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [collapsed, onToggle]);

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
      <div
        className="border-bottom border-secondary d-flex align-items-center"
        style={{ padding: "1rem", minHeight: "60px" }}
      >
        {!collapsed && (
          <span className="fs-5 fw-semibold">
            <i className="bi bi-lightning-charge-fill me-2"></i>SmartScript Hub
          </span>
        )}
      </div>

      <nav className="nav flex-column" style={{ padding: "0.5rem", whiteSpace: collapsed ? "nowrap" : "normal" }}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav-link text-white d-flex align-items-center ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "Dashboard" : undefined}
          style={{ padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 0.75rem", minWidth: 0 }}
        >
          <i className="bi bi-grid-1x2-fill me-2 flex-shrink-0" style={{ minWidth: "1.25rem" }}></i>
          {!collapsed && "Dashboard"}
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            `nav-link text-white d-flex align-items-center ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "History" : undefined}
          style={{ padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 0.75rem", minWidth: 0 }}
        >
          <i className="bi bi-clock-history me-2 flex-shrink-0" style={{ minWidth: "1.25rem" }}></i>
          {!collapsed && "History"}
        </NavLink>
        <NavLink
          to="/m3u8-downloader"
          className={({ isActive }) =>
            `nav-link text-white d-flex align-items-center ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "M3U8 Downloader" : undefined}
          style={{ padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 0.75rem", minWidth: 0 }}
        >
          <i className="bi bi-cloud-arrow-down me-2 flex-shrink-0" style={{ minWidth: "1.25rem" }}></i>
          {!collapsed && "M3U8 Downloader"}
        </NavLink>
        <NavLink
          to="/pdf-parser"
          className={({ isActive }) =>
            `nav-link text-white d-flex align-items-center ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "PDF Parser" : undefined}
          style={{ padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 0.75rem", minWidth: 0 }}
        >
          <i className="bi bi-file-earmark-pdf-fill me-2 flex-shrink-0" style={{ minWidth: "1.25rem" }}></i>
          {!collapsed && "PDF Parser"}
        </NavLink>
        <NavLink
          to="/spending-analysis"
          className={({ isActive }) =>
            `nav-link text-white d-flex align-items-center ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "Spending Analysis" : undefined}
          style={{ padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 0.75rem", minWidth: 0 }}
        >
          <i className="bi bi-graph-up me-2 flex-shrink-0" style={{ minWidth: "1.25rem" }}></i>
          {!collapsed && "Spending Analysis"}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `nav-link text-white d-flex align-items-center ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
          }
          title={collapsed ? "Settings" : undefined}
          style={{ padding: collapsed ? "0.75rem 0.5rem" : "0.75rem 0.75rem", minWidth: 0 }}
        >
          <i className="bi bi-gear-fill me-2 flex-shrink-0" style={{ minWidth: "1.25rem" }}></i>
          {!collapsed && "Settings"}
        </NavLink>
      </nav>

      <div className="mt-auto border-top border-secondary" style={{ padding: "0.5rem" }}>
        {!collapsed && (
          <div style={{ marginBottom: "0.5rem" }}>
            <small className="text-muted">SmartScript Hub v1.0</small>
          </div>
        )}
        <button
          className="btn btn-dark btn-sm p-0 flex-shrink-0 w-100"
          onClick={onToggle}
          title={collapsed ? "Expand" : "Collapse"}
          style={{ height: "36px" }}
        >
          <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`}></i>
        </button>
      </div>
    </div>
  );
}
