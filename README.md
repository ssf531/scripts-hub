# SmartScript Hub: Modular AI-Powered Automation Center

**SmartScript Hub** is a lightweight, self-hosted automation management platform built with **.NET 9** (ASP.NET Core API) and a **React + TypeScript** frontend (Vite). It is designed to automate repetitive digital tasks using local AI (Ollama) and various API integrations through a modular, plugin-based architecture.

---

## 1. Project Vision

The goal is to provide a "plug-and-play" automation hub where users can discover, configure, and execute scripts via a clean web interface. By utilizing Docker, the platform ensures that privacy-sensitive data—such as emails and local files—is processed locally without ever leaving your infrastructure.

---

## 2. System Architecture

The project is divided into several decoupled components to ensure maximum extensibility:

- **SmartScript.Core**: The foundation library defining script contracts (`IScript`), configuration metadata (`ScriptMetadata`), and file handling standards.

- **SmartScript.WebUI (React + ASP.NET Core API)**: A browser-based interface for managing script states, real-time monitoring, and dynamic configuration. The backend exposes REST API endpoints and a SignalR hub; the frontend is a React SPA with client-side routing.

- **SmartScript.Executor**: A background service that manages script lifecycles and triggers tasks based on schedules or specific events.

- **SmartScript.Scripts.EmailCleaner**: Built-in plugin implementing Gmail integration and AI-driven mail sorting.

- **SmartScript.Scripts.M3u8Downloader**: Built-in plugin for queued HLS/M3U8 video downloads using [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE).

  ***

## 3. Built-in Scripts

### AI Email Sorter

1.  **OAuth2 Authentication**: Users upload their `credentials.json` and complete the Gmail authorization flow in their browser.
2.  **Smart Fetching**: The script periodically retrieves unread emails from the inbox.
3.  **Local AI Summarization**: Email content is sent to a local **Ollama** model for summary generation and importance scoring (0–10).
4.  **Automated Decision-Making**: High-value emails remain unread; low-value/spam is automatically trashed.

### M3U8 Video Downloader

1.  **Download Queue**: Enter one or more `URL|Filename` pairs (or plain URLs) in the queue textarea.
2.  **Silent Execution**: Downloads run without a terminal window — all output is captured to the live log console.
3.  **Sequential Processing**: Items in the queue are processed one-by-one with per-item progress logging.
4.  **Configurable**: Thread count, output format (mp4/mkv/ts), save directory, and extra CLI arguments are all adjustable. Default values are read from `appsettings.json` under the `M3u8Downloader` section.

### PDF Bank Statement Parser

1.  **Multi-File Upload**: Drag & drop or select multiple PDF bank statements for batch processing.
2.  **Layout Detection**: AI-powered column detection automatically identifies Date, Description, Debit, Credit columns.
3.  **Transaction Parsing**: Converts PDFs to structured transaction tables with preview & export to CSV.
4.  **AI Validation**: Optional Ollama-based validation compares raw PDF text against parsed transactions, reporting discrepancies.
5.  **Queue or Sync**: Run validation synchronously for immediate results, or enqueue for batch processing via the AI Task Queue.
6.  **Load Past Results**: Retrieve previously validated transactions from the queue without re-uploading.

### Spending Analysis

1.  **CSV Import**: Upload bank statements (CSV) exported from PDF Parser or any bank statement format.
2.  **Grouping & Totaling**: Aggregate transactions by merchant/description, calculate totals and running balances.
3.  **Excel Export**: Download structured Excel workbook with transaction details and per-group summaries.
4.  **AI Categorization**: Use Ollama to automatically classify spending groups into standard categories (Food & Dining, Transport, Shopping, Bills & Utilities, Healthcare, Entertainment, Savings & Transfers, Other).
5.  **Queue or Sync**: Run analysis synchronously or enqueue for batch processing.
6.  **Load Past Results**: Retrieve previously categorized analyses from the queue to view results without CSV data.

  ***

## 4. AI Task Queue

The **AI Task Queue** provides asynchronous processing for long-running AI operations:

- **Dual Execution Modes**: Both PDF Parser and Spending Analysis offer sync (immediate, blocks UI) and async (enqueue, poll) execution paths.
- **Task Management**: View all queued, running, completed, and failed AI tasks in a unified dashboard.
- **Status Polling**: Real-time status updates with automatic result display once complete.
- **Result Storage**: Completed task outputs are persisted in SQLite for later retrieval.
- **Load from Queue**: Both PDF Parser and Spending Analysis can reload past completed tasks to view results without re-running.

  ***

## 5. Docker Deployment & Local File Synchronization

The platform leverages **Docker Bind Mounts** to allow scripts to interact directly with your host machine's file system.

### Directory Mapping

| Container Path | Host Path (Example) | Purpose                                                    |
| -------------- | ------------------- | ---------------------------------------------------------- |
| `/app/config`  | `./config`          | Stores OAuth tokens, SQLite database, and script settings. |

|
| `/app/downloads` | `D:/Downloads/Auto` | <br>**All files downloaded by scripts appear here instantly**.

|

### Example `docker-compose.yml`

```yaml
services:
  smart-script-hub:
    image: smart-script-hub:latest
    container_name: smart-script-hub
    ports:
      - "5000:8080"
    volumes:
      - ./config:/app/config
      - D:/Downloads/Auto:/app/downloads
    extra_hosts:
      - "host.docker.internal:host-gateway" # Access host Ollama service
    environment:
      - [cite_start]OLLAMA_BASE_URL=http://host.docker.internal:11434 [cite: 91, 92]

```

### Configuration

Key settings in `appsettings.json` / `appsettings.Development.json`:

| Setting | Default | Purpose |
|---------|---------|---------|
| `Ollama:BaseUrl` | `http://localhost:11434` | Ollama API endpoint. Override with `OLLAMA_BASE_URL` environment variable. |
| `Ollama:DefaultModel` | `llama3.2` | Default model used in PDF Parser and Spending Analysis if not overridden by user. |
| `PluginDirectory` | `./plugins` (dev) / `/app/plugins` (docker) | Where script `.dll` plugins are loaded from. |
| `ConnectionStrings:DefaultConnection` | `smartscript.db` (dev) / `/app/config/smartscript.db` (docker) | SQLite database path. Auto-created on startup. |

---

## 6. UI Design

- **Script Dashboard** (`/`): Card-based React view of all scripts with "Start/Stop" controls and success rate metrics.

- **Dynamic Settings**: An adaptive form engine that auto-renders inputs (`text`, `number`, `toggle`, `slider`, `textarea`) based on each script's metadata — no frontend changes needed to add new settings.

- **Per-Script UI Pages**: Each script has its own dedicated page component with a multi-step wizard:
  - **PDF Parser** (`/pdf-parser`): 5-step wizard for uploading PDFs, detecting layout, previewing transactions, and validating with AI.
  - **Spending Analysis** (`/spending-analysis`): 4-step wizard for importing CSVs, grouping transactions, exporting Excel, and categorizing with AI.
  - **M3U8 Downloader** (`/m3u8-downloader`): Download Queue card + Diagnostics card + Settings card.
  - **Email Cleaner** (`/email-cleaner`): Settings + Ollama/Gmail diagnostics side by side.

- **AI Task Queue** (`/ai-queue`): Unified dashboard for viewing, filtering, and managing all queued, running, completed, and failed AI tasks. Click any task to view the full prompt and output.

- **Real-time Logs**: Integrated **SignalR** console for viewing live script output. Dark terminal-style display with color-coded log levels.

- **Client-Side Routing**: React Router handles navigation between:
  - Dashboard (`/`)
  - Script Detail (`/script/:name`)
  - PDF Parser (`/pdf-parser`)
  - Spending Analysis (`/spending-analysis`)
  - M3U8 Downloader (`/m3u8-downloader`)
  - Email Cleaner (`/email-cleaner`)
  - AI Queue (`/ai-queue`)
  - History (`/history`)
  - Settings (`/settings`)

- **Diagnostics**: Per-script connection testing — M3U8 Downloader verifies N_m3u8DL-RE is installed; Email Cleaner tests Ollama connectivity and Gmail OAuth credentials.

- **Load from Queue**: PDF Parser and Spending Analysis both feature "Load from Queue" buttons to retrieve and display previously completed AI analysis results without re-running.

  ***

## 7. Important Considerations & Precautions

> [!IMPORTANT]
> **Privacy & Security**
>
> - **Local-First**: All LLM processing is performed by Ollama. No email content is sent to third-party AI providers.
> - **Credential Safety**: Sensitive tokens are stored in the `/app/config` volume. Ensure this directory is backed up and restricted.

> [!CAUTION]
> **Performance & Connectivity**
>
> - **Resource Impact**: Running large LLMs via Ollama can be CPU/GPU intensive. Monitor host resources if running multiple scripts simultaneously.
> - **Network Bridge**: When running in Docker, you must use `host.docker.internal` (Windows/Mac) or the appropriate gateway IP to reach the Ollama API on the host.
> - **Gmail Quotas**: Frequent polling may hit Google API rate limits. It is recommended to set reasonable intervals (e.g., every 15–30 minutes).

---

## 8. Development Roadmap

- **Phase 1** ✅: Core interface definitions, Docker multi-stage build setup, and Gmail OAuth integration.

- **Phase 2** ✅: React Dashboard with REST API backend and the dynamic form engine.

- **Phase 3** ✅: Quartz.NET task scheduling and hot-loading support for `.dll` plugins.

- **Phase 4** ✅: M3U8 Video Downloader plugin with download queue, per-script UI pages, and `Textarea` setting type.

- **Phase 5** ✅: PDF Bank Statement Parser with AI layout detection, transaction parsing, and Ollama validation.

- **Phase 6** ✅: Spending Analysis tool with CSV import, transaction grouping, Excel export, and AI categorization.

- **Phase 7** ✅: AI Task Queue with async processing, status polling, result persistence, and "Load from Queue" functionality in PDF Parser and Spending Analysis. Default Ollama model configured via `appsettings.json`.

- **Phase 8** 🔄: *Future phases* — Custom webhook triggers, workflow automation, advanced scheduling, multi-tenant support.

  ***
