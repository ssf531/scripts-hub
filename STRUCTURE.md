# Implementation Structure

## Solution Layout

```
SmartScriptHub.slnx
├── src/
│   ├── SmartScript.Core/              # Shared contracts and models (no dependencies)
│   ├── SmartScript.Executor/          # Background services, scheduling, plugin loading
│   ├── SmartScript.WebUI/             # ASP.NET Core API + React SPA (host project)
│   └── SmartScript.Scripts.EmailCleaner/  # Built-in Gmail AI sorter plugin
├── Dockerfile                         # Multi-stage build (SDK -> runtime)
├── docker-compose.yml                 # Container orchestration with bind mounts
└── README.md                          # Project vision and roadmap
```

---

## Project Details

### SmartScript.Core

Pure abstractions library with zero external dependencies.

```
SmartScript.Core/
├── Interfaces/
│   ├── IScript.cs              # Core script contract: ExecuteAsync, StopAsync, Metadata
│   └── IScriptLoader.cs        # Plugin loader contract: LoadScripts, LoadFromDirectory, Unload
├── Models/
│   ├── ScriptMetadata.cs       # Name, Description, Version, Author, Icon, CronExpression, Settings
│   ├── ScriptResult.cs         # Success, Message, Timestamp, Details dictionary
│   ├── ScriptState.cs          # Enum: Idle, Running, Stopped, Error
│   ├── SettingDefinition.cs    # Key, DisplayName, Type, DefaultValue, Min, Max
│   ├── SettingType.cs          # Enum: Text, Number, Toggle, Slider
│   ├── LogEntry.cs             # Timestamp, Level, Message, ScriptName
│   └── LogLevel.cs             # Enum: Info, Warning, Error
└── Services/
    ├── IOllamaClient.cs        # GenerateAsync(prompt, model, ct)
    └── IScriptLogger.cs        # LogAsync(scriptName, message, level)
```

**Referenced by**: Executor, WebUI, EmailCleaner

---

### SmartScript.Executor

Background services for script lifecycle, scheduling, and plugin management.

```
SmartScript.Executor/
├── ScriptManager.cs            # Thread-safe ConcurrentDictionary registry
│                               #   Register, Unregister, GetScript, GetAllScripts
│                               #   GetState, SetState, StartTracking, StopTracking
├── ScriptExecutorService.cs    # BackgroundService: registers built-in + plugin scripts,
│                               #   triggers Quartz scheduling, starts FileSystemWatcher
├── PluginLoader.cs             # IScriptLoader impl using AssemblyLoadContext (collectible)
│                               #   Isolated loading, Unload support, PluginDirectory property
└── Scheduling/
    ├── QuartzSchedulerService.cs   # Schedule/unschedule scripts by cron expression
    └── ScriptJob.cs                # IJob impl: resolves script from ScriptManager, executes
```

**NuGet packages**: Quartz 3.16.1, Quartz.Extensions.Hosting 3.16.1, Microsoft.Extensions.Hosting.Abstractions
**References**: SmartScript.Core

---

### SmartScript.WebUI

ASP.NET Core Web API + React SPA host application. Entry point for the entire system.

```
SmartScript.WebUI/
├── Program.cs                  # DI registration, EF Core, SignalR, Quartz, hosted services
├── appsettings.json            # Connection string, Ollama URL, plugin directory
├── Controllers/
│   ├── ScriptsController.cs    # REST API: list/get/run/stop scripts, save settings
│   ├── DiagnosticsController.cs # REST API: test Ollama & email connections
│   └── ConfigController.cs     # REST API: global config (Ollama URL, plugin dir)
├── ClientApp/                  # React + TypeScript + Vite SPA
│   ├── package.json            # Frontend dependencies (react, signalr, bootstrap)
│   ├── vite.config.ts          # Vite config with API/SignalR proxy
│   ├── tsconfig.json           # TypeScript config
│   ├── index.html              # SPA entry point
│   └── src/
│       ├── main.tsx            # React entry, BrowserRouter setup
│       ├── App.tsx             # Layout: sidebar Navbar + Outlet + shared collapsible log panel
│       ├── vite-env.d.ts       # CSS module type declarations
│       ├── types/index.ts      # TypeScript interfaces (ScriptInfo, LogEntry, etc.)
│       ├── api/
│       │   ├── client.ts       # Fetch wrapper (base URL, error handling)
│       │   ├── scripts.ts      # Script API functions
│       │   ├── diagnostics.ts  # Diagnostics API functions
│       │   └── config.ts       # Config API functions
│       ├── hooks/
│       │   └── useLogHub.ts    # SignalR hook: connect, filter by script, auto-reconnect
│       ├── pages/
│       │   ├── Dashboard.tsx   # Card grid, Start/Stop, state badges, success rates
│       │   ├── ScriptDetail.tsx # Dynamic form engine + diagnostics + Run/Stop button
│       │   ├── History.tsx     # Script run history log
│       │   ├── PdfParser.tsx   # PDF bank statement parser wizard
│       │   ├── SpendingAnalysis.tsx # Spending grouping, Excel export, AI categorisation
│       │   └── Settings.tsx    # Global config display (Ollama URL, plugin dir, OAuth info)
│       └── components/
│           ├── LogConsole.tsx   # Global collapsible bottom log panel (all scripts, shared)
│           ├── ScriptCard.tsx   # Individual script card with state badge + progress bar
│           └── Navbar.tsx       # Dark sidebar with active link highlighting
├── Data/
│   ├── AppDbContext.cs         # EF Core DbContext (SQLite)
│   └── Entities/
│       ├── ScriptRunRecord.cs  # Id, ScriptName, StartedAt, CompletedAt, Success, ResultMessage
│       └── ScriptSettingEntity.cs  # Id, ScriptName, Key, Value (unique index on Name+Key)
├── Hubs/
│   └── LogHub.cs               # SignalR hub at /hubs/log (JoinScriptGroup, LeaveScriptGroup)
└── Services/
    ├── OllamaClient.cs         # IOllamaClient impl: POST /api/generate with error handling
    ├── ScriptHubService.cs     # Bridges API to scripts: RunScriptAsync, SaveSettingsAsync, GetSuccessRatesAsync
    ├── LogBroadcastService.cs  # Singleton: accepts LogEntry, broadcasts via SignalR + OnLogReceived event
    ├── ScriptLogger.cs         # IScriptLogger impl: creates LogEntry, delegates to LogBroadcastService
    └── TestConnectionService.cs # Diagnostics: test Ollama connectivity, check Gmail credential files
```

**NuGet packages**: Microsoft.EntityFrameworkCore.Sqlite 9.x, Quartz.Extensions.Hosting
**Frontend packages** (via npm): react, react-router-dom, @microsoft/signalr, bootstrap, bootstrap-icons, vite, typescript
**References**: SmartScript.Core, SmartScript.Executor, SmartScript.Scripts.EmailCleaner

---

### SmartScript.Scripts.EmailCleaner

Built-in plugin implementing the AI Email Sorter workflow.

```
SmartScript.Scripts.EmailCleaner/
├── EmailCleanerScript.cs       # IScript impl: fetch -> Ollama summarize -> score -> trash/keep
│                               #   Settings: ollamaModel, importanceThreshold, maxEmails, autoTrash, credentialPath
│                               #   Default cron: every 15 minutes
├── GmailAuthService.cs         # OAuth2 flow: loads credentials.json, stores token in /app/config
│                               #   Auto-refreshes expired tokens
└── GmailClientWrapper.cs       # GmailService wrapper: FetchUnreadMessagesAsync, TrashMessageAsync,
                                #   MarkAsReadAsync with initialization guard
```

**NuGet packages**: Google.Apis.Gmail.v1 1.73.0, Google.Apis.Auth 1.73.0
**References**: SmartScript.Core

---

## Dependency Graph

```
SmartScript.Core  (no dependencies)
       ^
       |
       +------ SmartScript.Executor  (+ Quartz.NET)
       |              ^
       |              |
       +------ SmartScript.Scripts.EmailCleaner  (+ Google.Apis.Gmail)
       |              ^
       |              |
       +--------------+------ SmartScript.WebUI  (host: EF Core, SignalR, Quartz hosting)
```

---

## Key Integration Points

| Feature             | Component                        | Mechanism                                              |
| ------------------- | -------------------------------- | ------------------------------------------------------ |
| Script discovery    | ScriptExecutorService            | DI `IEnumerable<IScript>` + PluginLoader               |
| Script execution    | ScriptHubService                 | Calls `IScript.ExecuteAsync` via ScriptManager         |
| Real-time logs      | LogBroadcastService + LogHub     | SignalR push to all clients; displayed in global bottom panel in App.tsx |
| Script logging      | ScriptLogger                     | IScriptLogger impl delegates to LogBroadcastService    |
| REST API            | Controllers/\*                   | ASP.NET Core controllers wrapping existing services    |
| Dynamic settings UI | ScriptDetail.tsx                 | React form renders inputs from ScriptMetadata.Settings; Run/Stop button in header |
| Diagnostics         | TestConnectionService            | Test Ollama connectivity, check Gmail credentials      |
| Persistence         | AppDbContext                     | SQLite via EF Core (auto-created on startup)           |
| Scheduling          | QuartzSchedulerService           | Cron-based via `ScriptMetadata.CronExpression`         |
| Plugin hot-loading  | PluginLoader + FileSystemWatcher | AssemblyLoadContext per DLL, auto-reload on change     |
| AI processing       | OllamaClient                     | HTTP POST to Ollama REST API (`/api/generate`)         |
