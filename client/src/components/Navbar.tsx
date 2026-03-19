import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";

interface NavbarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { to: "/", end: true, icon: "bi-grid-1x2-fill", label: "Dashboard" },
  { to: "/m3u8-downloader", icon: "bi-cloud-arrow-down", label: "M3U8 Downloader" },
  { to: "/pdf-parser", icon: "bi-file-earmark-pdf-fill", label: "PDF Parser" },
  { to: "/spending-analysis", icon: "bi-graph-up", label: "Spending Analysis" },
  { to: "/ai-queue", icon: "bi-cpu", label: "AI Queue" },
  { to: "/history", icon: "bi-clock-history", label: "History" },
  { to: "/settings", icon: "bi-gear-fill", label: "Settings" },
];

export function Navbar({ collapsed, onToggle }: NavbarProps) {
  const wasSmallRef = useRef(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const isSmall = window.innerWidth < 768;
      // Only auto-collapse when transitioning from large → small
      if (isSmall && !wasSmallRef.current && !collapsed) {
        onToggle();
      }
      wasSmallRef.current = isSmall;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [collapsed, onToggle]);

  return (
    <div
      className="d-flex flex-column bg-dark text-white flex-shrink-0"
      style={{
        width: collapsed ? "60px" : "250px",
        height: "100vh",
        transition: "width 0.3s ease-in-out",
        borderRight: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "2px 0 10px rgba(0, 0, 0, 0.35)",
        overflowX: "hidden",
      }}
    >
      {/* Header — fixed 60px */}
      <div
        className="border-bottom border-secondary d-flex align-items-center flex-shrink-0"
        style={{
          height: "60px",
          padding: "0 1rem",
          overflow: "hidden",
          justifyContent: collapsed ? "center" : "flex-start",
          whiteSpace: "nowrap",
        }}
      >
        {collapsed ? (
          <i className="bi bi-lightning-charge-fill fs-5"></i>
        ) : (
          <span className="fs-5 fw-semibold">
            <i className="bi bi-lightning-charge-fill me-2"></i>SmartScript Hub
          </span>
        )}
      </div>

      {/* Nav — scrollable, fills remaining space */}
      <nav
        className="nav flex-column flex-grow-1"
        style={{ padding: "0.5rem", overflowY: "auto", overflowX: "hidden" }}
      >
        {NAV_ITEMS.map(({ to, end, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-link text-white d-flex align-items-center ${isActive ? "bg-primary bg-opacity-25 rounded" : ""}`
            }
            title={collapsed ? label : undefined}
            style={{
              padding: collapsed ? "0.75rem 0" : "0.75rem 0.75rem",
              justifyContent: collapsed ? "center" : "flex-start",
              whiteSpace: "nowrap",
            }}
          >
            <i
              className={`bi ${icon} flex-shrink-0${!collapsed ? " me-2" : ""}`}
              style={{ minWidth: "1.25rem", textAlign: "center" }}
            ></i>
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Footer — fixed 40px, matches LogConsole collapsed height */}
      <div
        className="border-top border-secondary d-flex align-items-center flex-shrink-0"
        style={{
          height: "40px",
          overflow: "hidden",
          padding: collapsed ? "0" : "0 0.75rem",
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {!collapsed && (
          <small className="text-muted" style={{ fontSize: "0.72rem", whiteSpace: "nowrap" }}>
            v1.0
          </small>
        )}
        <button
          className="btn btn-dark btn-sm d-flex align-items-center justify-content-center p-0 flex-shrink-0"
          onClick={onToggle}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            height: "28px",
            width: "28px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "4px",
          }}
        >
          <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`}></i>
        </button>
      </div>
    </div>
  );
}
