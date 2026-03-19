# Implementation Structure

## Solution Layout

```
SmartScriptHub.slnx
├── client/                                    # React + TypeScript SPA (Vite)
├── src/
│   ├── SmartScript.Core/                      # Shared contracts and models (no dependencies)
│   ├── SmartScript.Executor/                  # Background services, scheduling, plugin loading
│   ├── SmartScript.Api/                       # ASP.NET Core API host (serves built SPA from wwwroot/)
│   ├── SmartScript.Scripts.EmailCleaner/      # Built-in Gmail AI sorter plugin
│   ├── SmartScript.Scripts.M3u8Downloader/    # Built-in HLS/M3U8 video downloader plugin
│   ├── SmartScript.Scripts.PdfParser/         # PDF bank statement parser service
│   └── SmartScript.Scripts.SpendingAnalysis/  # Spending analysis and Excel export service
├── tests/
│   └── SmartScript.Tests/                     # xUnit test project
├── Dockerfile                                 # Multi-stage build (SDK + Node -> runtime)
├── docker-compose.yml                         # Container orchestration with bind mounts
└── README.md                                  # Project vision and roadmap
```

---

## Project Details

### client/

React + TypeScript SPA built with Vite. Entirely independent of the C# projects — communicates with the backend only via REST API and SignalR.

```
client/
├── package.json            # Frontend dependencies (react 19, react-router-dom 7, signalr, bootstrap 5)
├── vite.config.ts          # Vite config: dev server port 3000, proxy /api + /hubs to :5220,
│                           #   build output → ../src/SmartScript.Api/wwwroot
├── tsconfig.json           # TypeScript: ES2020 target, strict mode, bundler resolution
├── index.html              # SPA entry point (<div id="root">)
└── src/
    ├── main.tsx            # React entry, BrowserRouter, all route definitions
    ├── App.tsx             # Layout: collapsible sidebar Navbar + Outlet + shared log panel (SignalR)
    ├── vite-env.d.ts       # Vite client type declarations
    ├── types/index.ts      # TypeScript interfaces (ScriptInfo, SettingDefinition, LogEntry, etc.)
    ├── api/
    │   ├── client.ts           # Typed fetch wrapper with base URL and error handling
    │   ├── scripts.ts          # Script API (list, get, run, stop, save settings)
    │   ├── diagnostics.ts      # Diagnostics API (test Ollama, email, M3u8DL)
    │   ├── config.ts           # Global config API (Ollama URL, default model)
    │   ├── pdf.ts              # PDF Parser API (layout detection, parsing, validation sync/queue)
    │   ├── spending.ts         # Spending Analysis API (CSV import, grouping, categorisation)
    │   ├── m3u8.ts             # M3U8 Downloader API (queue, progress, downloads)
    │   ├── aiTasks.ts          # AI Task Queue API (list, get, delete, enqueue)
    │   └── history.ts          # Run history API
    ├── hooks/
    │   └── useLogHub.ts    # SignalR hook: connect to /hubs/log, filter by script, auto-reconnect
    ├── components/
    │   ├── Navbar.tsx       # Dark sidebar with active route highlighting and collapse toggle
    │   ├── ScriptCard.tsx   # Script card: state badge, success rate, progress bar, Run/Stop
    │   └── LogConsole.tsx   # Collapsible bottom log panel with colour-coded log levels
    └── pages/
        ├── Dashboard.tsx           # Script card grid
        ├── ScriptDetail.tsx        # Dynamic form engine rendering SettingDefinition[] as inputs
        ├── History.tsx             # Script run history table
        ├── PdfParser.tsx           # 5-step wizard: upload → detect layout → preview → parse → validate/export
        ├── SpendingAnalysis.tsx    # 4-step wizard: import CSV → group → export Excel → AI categorise
        ├── AiQueue.tsx             # AI task queue dashboard with filtering and task detail view
        ├── EmailCleaner.tsx        # Email cleaner settings and Gmail diagnostics
        ├── M3u8Downloader.tsx      # Download queue, progress tracking, settings, diagnostics
        └── Settings.tsx            # Global config display (Ollama URL, default model, plugin dir)
```

**Built by**: `npm run build` — outputs to `../src/SmartScript.Api/wwwroot/` (gitignored)
**Dev server**: `npm run dev` — http://localhost:3000, proxies `/api` and `/hubs` to http://localhost:5220

---

### SmartScript.Core

Pure abstractions library with zero external dependencies.

```
SmartScript.Core/
├── Interfaces/
│   ├── IScript.cs              # Core script contract: ExecuteAsync, StopAsync, Metadata
│   └── IScriptLoader.cs        # Plugin loader contract: LoadScripts, LoadFromDirectory, Unload
├── Models/
│   ├── ScriptMetadata.cs       # Name, Description, Version, Author, Icon, CronExpression, Settings
│   ├── ScriptResult.cs         # Success, Message, Timestamp, Details, UpdatedSettings
│   ├── ScriptState.cs          # Enum: Idle, Running, Stopped, Error
│   ├── SettingDefinition.cs    # Key, DisplayName, Type, DefaultValue, Min, Max
│   ├── SettingType.cs          # Enum: Text, Number, Toggle, Slider, Textarea
│   ├── LogEntry.cs             # Timestamp, Level, Message, ScriptName
│   └── LogLevel.cs             # Enum: Info, Warning, Error
└── Services/
    ├── IOllamaClient.cs        # GenerateAsync(prompt, model, ct) → string
    └── IScriptLogger.cs        # LogAsync(scriptName, message, level)
```

**Referenced by**: all other projects

---

### SmartScript.Executor

Background services for script lifecycle, scheduling, and plugin management.

```
SmartScript.Executor/
├── ScriptManager.cs            # Thread-safe registry: Register, GetScript, GetState, SetState
├── ScriptExecutorService.cs    # BackgroundService: registers scripts, triggers Quartz, FileSystemWatcher
├── PluginLoader.cs             # IScriptLoader via AssemblyLoadContext (collectible); supports Unload
└── Scheduling/
    ├── QuartzSchedulerService.cs   # Schedule/unschedule cron jobs per script
    └── ScriptJob.cs                # IJob: resolves script from ScriptManager, calls ExecuteAsync
```

**NuGet**: Quartz 3.x, Quartz.Extensions.Hosting, Microsoft.Extensions.Hosting.Abstractions
**References**: SmartScript.Core

---

### SmartScript.Api

ASP.NET Core 9 Web API. Entry point for the entire system. Serves the React SPA from `wwwroot/` in production.

```
SmartScript.Api/
├── Program.cs                  # DI, EF Core, SignalR, Quartz hosting, service registrations
├── appsettings.json            # Ollama URL, plugin directory, SQLite connection string, M3u8 settings
├── appsettings.Development.json
├── Controllers/
│   ├── ScriptsController.cs        # REST: list/get/run/stop scripts, save settings
│   ├── DiagnosticsController.cs    # REST: test Ollama, email, M3u8DL
│   ├── ConfigController.cs         # REST: expose global config (Ollama URL, default model)
│   ├── PdfParserController.cs      # REST: detect layout, preview, parse PDFs, validate (sync/queue), export CSV
│   ├── SpendingAnalysisController.cs # REST: CSV import/group, categorise (sync/queue), export Excel
│   ├── M3u8DownloaderController.cs # REST: download queue management
│   ├── AiTaskController.cs         # REST: list/get/delete AI tasks, enqueue new tasks
│   └── HistoryController.cs        # REST: query script run history
├── Data/
│   ├── AppDbContext.cs         # EF Core DbContext (SQLite)
│   └── Entities/
│       ├── ScriptRunRecord.cs      # Id, ScriptName, StartedAt, CompletedAt, Success, ResultMessage
│       ├── ScriptSettingEntity.cs  # Id, ScriptName, Key, Value (unique index on Name+Key)
│       └── AiTask.cs               # Id, Type, Description, Prompt, Model, Status, Output, timestamps
├── Hubs/
│   └── LogHub.cs               # SignalR hub at /hubs/log (JoinScriptGroup, LeaveScriptGroup)
├── Services/
│   ├── OllamaClient.cs            # IOllamaClient: POST /api/generate with 10-min timeout
│   ├── ScriptHubService.cs        # RunScriptAsync, SaveSettingsAsync, GetSuccessRatesAsync
│   ├── LogBroadcastService.cs     # Singleton: receives LogEntry, broadcasts via SignalR + event
│   ├── ScriptLogger.cs            # IScriptLogger: delegates to LogBroadcastService
│   ├── TestConnectionService.cs   # Ollama connectivity, Gmail credential file checks
│   └── AiTaskQueueService.cs      # BackgroundService: Channel<int> queue, polls Ollama, persists to SQLite
└── wwwroot/                    # Built React SPA (gitignored; generated by `npm run build`)
```

**NuGet**: Microsoft.EntityFrameworkCore.Sqlite 9.x, Quartz.Extensions.Hosting
**References**: SmartScript.Core, Executor, EmailCleaner, M3u8Downloader, PdfParser, SpendingAnalysis

---

### SmartScript.Scripts.EmailCleaner

Built-in plugin implementing the Gmail AI email sorter.

```
SmartScript.Scripts.EmailCleaner/
├── EmailCleanerScript.cs       # IScript: fetch → Ollama summarise → score → trash/keep
│                               #   Settings: ollamaModel, importanceThreshold, maxEmails, autoTrash
│                               #   Default cron: every 15 minutes
├── GmailAuthService.cs         # OAuth2 flow: loads credentials.json, persists token in /app/config
└── GmailClientWrapper.cs       # GmailService wrapper: FetchUnreadMessagesAsync, TrashMessageAsync
```

**NuGet**: Google.Apis.Gmail.v1, Google.Apis.Auth
**References**: SmartScript.Core

---

### SmartScript.Scripts.M3u8Downloader

Built-in plugin for queued HLS/M3U8 video downloads.

```
SmartScript.Scripts.M3u8Downloader/
└── M3u8DownloaderScript.cs     # IScript: reads queue from settings, runs N_m3u8DL-RE per item
                                #   Settings: queue (textarea), savedir, threadcount, outputformat
```

**References**: SmartScript.Core

---

### SmartScript.Scripts.PdfParser

PDF bank statement parsing service used by `PdfParserController`.

```
SmartScript.Scripts.PdfParser/
└── PdfParserService.cs         # Standalone service (not IScript — invoked directly by controller)
                                #   Models: ColumnDef, ColumnLayout, BankTransaction, PreviewRow, ParsedFile
                                #   DetectLayout(stream): keyword-based column header detection
                                #   PreviewLayout(stream, layout): first 5 data rows colour-tagged by column
                                #   Parse(stream, filename, layout): full multi-page transaction extraction
```

**NuGet**: PdfPig 0.1.9
**References**: SmartScript.Core

---

### SmartScript.Scripts.SpendingAnalysis

CSV transaction grouping and Excel export service used by `SpendingAnalysisController`.

```
SmartScript.Scripts.SpendingAnalysis/
└── SpendingAnalysisService.cs  # Standalone service (not IScript — invoked directly by controller)
                                #   Models: CsvRow, TransactionGroup, CategoryAssignment
                                #   ParseCsv(content): flexible header detection, quoted-field handling
                                #   GroupTransactions(rows, dateFrom, dateTo): normalise + aggregate
                                #   BuildExcel(rows, groups): two-sheet XLSX with styled headers
```

**NuGet**: ClosedXML 0.104.x
**References**: SmartScript.Core

---

## Dependency Graph

```
SmartScript.Core  (no dependencies)
       ^
       |
       +------ SmartScript.Executor          (+ Quartz.NET)
       |              ^
       |              |
       +------ SmartScript.Scripts.EmailCleaner      (+ Google.Apis.Gmail)
       |
       +------ SmartScript.Scripts.M3u8Downloader
       |
       +------ SmartScript.Scripts.PdfParser         (+ PdfPig)
       |
       +------ SmartScript.Scripts.SpendingAnalysis  (+ ClosedXML)
       |
       +------+------+------+------+------+------ SmartScript.Api  (host: EF Core, SignalR, Quartz hosting)
```

---

## Key Integration Points

| Feature | Component | Mechanism |
|---------|-----------|-----------|
| Script discovery | ScriptExecutorService | DI `IEnumerable<IScript>` + PluginLoader |
| Script execution | ScriptHubService | `IScript.ExecuteAsync` via ScriptManager |
| Real-time logs | LogBroadcastService + LogHub | SignalR push to clients (`ReceiveLog`) |
| Dynamic settings UI | ScriptDetail.tsx | Renders `SettingDefinition[]` as form inputs (no frontend changes needed per script) |
| REST API | Controllers/* | ASP.NET Core controllers; JSON camelCase, Swagger-ready |
| PDF parsing | PdfParserService | PdfPig word extraction + bounding-box column mapping |
| Spending analysis | SpendingAnalysisService | CSV parsing, description normalisation, ClosedXML export |
| AI tasks (async) | AiTaskQueueService + Channel<int> | Channel-based dispatch, Ollama polling, SQLite persistence |
| Task retrieval | AiTask entity + AppDbContext | "Load from Queue" in PDF Parser and Spending Analysis |
| Scheduling | QuartzSchedulerService | Cron via `ScriptMetadata.CronExpression` |
| Plugin hot-loading | PluginLoader + FileSystemWatcher | Collectible AssemblyLoadContext per DLL |
| Persistence | AppDbContext (SQLite) | Auto-created on startup; stores settings, run history, AI tasks |
| Frontend build | Vite + PublishSpa (csproj) | `npm run build` → `src/SmartScript.Api/wwwroot/`; triggered on `dotnet publish` |
| SPA serving | ASP.NET static files + fallback | `UseStaticFiles()` + `MapFallbackToFile("index.html")` |
