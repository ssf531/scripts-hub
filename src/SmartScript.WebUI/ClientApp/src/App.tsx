import { Outlet } from "react-router-dom";
import { Navbar } from "./components/Navbar";

export function App() {
  return (
    <div className="d-flex">
      <Navbar />
      <main
        className="flex-grow-1 p-4"
        style={{ minHeight: "100vh", background: "#f8f9fa" }}
      >
        <Outlet />
      </main>
    </div>
  );
}
