import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { App } from "./App";
import { Dashboard } from "./pages/Dashboard";
import { ScriptDetail } from "./pages/ScriptDetail";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { PdfParser } from "./pages/PdfParser";
import { SpendingAnalysis } from "./pages/SpendingAnalysis";
import { M3u8DownloaderPage } from "./pages/scripts/M3u8DownloaderPage";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.min.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="/script/:name" element={<ScriptDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<History />} />
          <Route path="/pdf-parser" element={<PdfParser />} />
          <Route path="/spending-analysis" element={<SpendingAnalysis />} />
          <Route path="/m3u8-downloader" element={<M3u8DownloaderPage scriptName="M3U8 Video Downloader" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
