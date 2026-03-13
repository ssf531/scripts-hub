# SmartScript Hub — Session Context

> Paste this file at the start of a new Claude session to resume work immediately.
> **Update the Status section after each milestone.**

---

## Project Overview

**SmartScript Hub** — a .NET 9 + React 19 web app for managing and running automation scripts.

| Layer | Tech |
|-------|------|
| Backend | ASP.NET Core 9, EF Core + SQLite, Quartz.NET, SignalR |
| Frontend | React 19, TypeScript, Vite, Bootstrap 5.3, Bootstrap Icons |
| AI | Ollama (local LLM via `IOllamaClient`) |
| Tests | xUnit 2.* + NSubstitute 5.* |

**Key directories:**
```
/src/SmartScript.WebUI/           ← main host (API + React SPA)
  Controllers/                    ← REST endpoints
  Services/                       ← business logic
  ClientApp/src/
    pages/                        ← React page components
    api/                          ← fetch wrappers
    components/                   ← Navbar, etc.
/tests/SmartScript.Tests/         ← xUnit test project
```

**Routing:**
- Routes declared in `ClientApp/src/main.tsx`
- Nav links in `ClientApp/src/components/Navbar.tsx`
- API base: `/api/`

---

## Features Added (this session)

### Process 1 — PDF Bank Statement Parser (`/pdf-parser`)

A 5-step wizard page that:
1. Uploads multiple bank statement PDFs
2. Detects column layout from PDF header keywords (DATE, DESCRIPTION, DEBIT, CREDIT, BALANCE…)
3. Lets user preview & adjust detected column X-ranges
4. Parses all PDFs using confirmed layout → displays merged transaction table + CSV export
5. Validates parsed data against raw PDF text using Ollama

### Process 2 — Spending Analysis (`/spending-analysis`)

A 4-step wizard page that:
1. Imports CSV files (from Process 1 or any bank CSV)
2. Groups similar transactions by normalised description, supports merge & rename
3. Exports grouped data to Excel (2 sheets: Transactions + Groups Summary)
4. Uses Ollama to categorise spending into standard categories + shows bar chart breakdown

---

## Status

### Backend
- [x] `SmartScript.WebUI.csproj` — added `PdfPig 0.1.9` and `ClosedXML 0.104.*`
- [x] `Services/PdfParserService.cs` — layout detection + parse logic
- [x] `Controllers/PdfParserController.cs` — 5 endpoints (detect-layout, preview-layout, parse, validate, export)
- [x] `Services/SpendingAnalysisService.cs` — CSV parsing, grouping, Excel export
- [x] `Controllers/SpendingAnalysisController.cs` — 3 endpoints (group, export-excel, categorise)
- [x] `Program.cs` — registered `PdfParserService` and `SpendingAnalysisService`

### Frontend
- [x] `api/pdf.ts` — detectLayout, previewLayout, parsePdfs, validateTransactions, exportCsv
- [x] `api/spending.ts` — groupCsvs, exportExcel, categorise
- [x] `pages/PdfParser.tsx` — 5-step wizard
- [x] `pages/SpendingAnalysis.tsx` — 4-step wizard
- [x] `main.tsx` — routes `/pdf-parser` and `/spending-analysis` added
- [x] `components/Navbar.tsx` — PDF Parser and Spending Analysis links added

### Tests
- [x] `PdfParserServiceTests.cs` — IsDate (Theory), GroupWordsIntoLines, ParseLineToTransaction
- [x] `PdfParserControllerTests.cs` — Export (headers, row count, null amounts, column selection), Validate (success + Ollama error)
- [x] `SpendingAnalysisServiceTests.cs` — NormaliseDescription, GroupTransactions, FiltersByDate, ParseCsv, BuildExcel

---

## Key Technical Decisions

| Decision | Reason |
|----------|--------|
| **PdfPig 0.1.9** | MIT license, pure managed .NET, provides word X/Y coordinates needed for column detection |
| **ClosedXML 0.104** | MIT license, clean API for creating .xlsx files with multiple sheets |
| **Layout detection via header keywords** | Bank PDFs vary widely; scanning header row for DATE/DESCRIPTION/DEBIT etc. makes detection bank-agnostic |
| **Preview step before full parse** | Lets user confirm column boundaries are correct before parsing all pages |
| **Ollama for validation** | Uses existing `IOllamaClient` already wired in DI; sends raw text + parsed JSON for AI diff |
| **Step wizard UI** | Sequential steps fit the linear workflow (upload → layout → preview → parse → validate) better than cards/tabs |
| **Server-side CSV + Excel** | Avoids large JS libraries; backend handles file generation cleanly |

---

## Gotchas & Constraints

- **PdfPig column detection** only works if the bank statement PDF has a visible text header row with standard keywords. Image-based (scanned) PDFs will not work.
- **Multiple PDFs in one parse** must come from the same bank (same layout). Different banks need separate detect-layout + parse sessions.
- **Ollama must be running** for the validate and categorise features. The app shows a clear error if Ollama is unavailable — other steps are unaffected.
- **ClosedXML** requires the Nuget package `ClosedXML` (not `ClosedXML.Excel`).
- **SQLite path** for the app database: `/app/config/smartscript.db` (configured in `appsettings.json`).
- **Frontend** is built separately (`npm run build` in `ClientApp/`) and output goes to `wwwroot/`. During development serve via Vite dev server or build to `wwwroot/`.

---

## What's Next (if returning to continue)

- [ ] Run `dotnet build` to verify compilation
- [ ] Run `dotnet test` to verify all unit tests pass
- [ ] Run frontend: `cd ClientApp && npm install && npm run dev`
- [ ] Test with a real bank statement PDF
- Potential improvements:
  - Support for scanned PDFs via OCR (Tesseract)
  - Per-column regex overrides for non-standard date/amount formats
  - Save/load column layout profiles for repeat use with the same bank

---

## Git Branch

Feature branch: `claude/pdf-bank-statement-parser-Oig2c`
