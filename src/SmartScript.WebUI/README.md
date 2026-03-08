# SmartScript.WebUI

Blazor Server host application for SmartScript Hub. This is the entry point that wires together all services and presents the web-based management interface.

## Contents

```
SmartScript.WebUI/
├── Program.cs                     # DI setup, middleware, startup
├── appsettings.json               # DB connection, Ollama URL, plugin dir
├── Components/
│   ├── App.razor                  # Root HTML (Bootstrap 5, Bootstrap Icons CDN)
│   ├── Routes.razor               # Router
│   ├── _Imports.razor             # Global Razor usings
│   ├── Layout/
│   │   ├── MainLayout.razor       # Sidebar + main content area
│   │   └── NavMenu.razor          # Dashboard / Settings navigation
│   └── Pages/
│       ├── Home.razor             # Script dashboard (card grid)
│       ├── ScriptDetail.razor     # Dynamic settings form + live log console
│       ├── Settings.razor         # Global configuration display
│       └── Error.razor            # Error boundary
├── Data/
│   ├── AppDbContext.cs            # EF Core DbContext (SQLite)
│   └── Entities/
│       ├── ScriptRunRecord.cs     # Execution history record
│       └── ScriptSettingEntity.cs # Persisted script settings
├── Hubs/
│   └── LogHub.cs                  # SignalR hub for real-time logs
└── Services/
    ├── OllamaClient.cs            # IOllamaClient HTTP impl
    ├── ScriptHubService.cs        # Bridges UI to script execution
    └── LogBroadcastService.cs     # Broadcasts log entries via SignalR
```

## Dependencies

| Package                              | Version | Purpose                    |
| ------------------------------------ | ------- | -------------------------- |
| Microsoft.EntityFrameworkCore.Sqlite | 9.x     | SQLite database provider   |
| Microsoft.EntityFrameworkCore.Design | 9.x     | EF Core tooling support    |
| Microsoft.AspNetCore.SignalR.Client  | 10.0.3  | SignalR client for Blazor  |
| Quartz.Extensions.Hosting            | 3.x     | Quartz hosted service + DI |

**Project references**: SmartScript.Core, SmartScript.Executor, SmartScript.Scripts.EmailCleaner

## Pages

### Home (Dashboard)

Route: `/`

- Displays all registered scripts as Bootstrap cards.
- Each card shows: icon, name, description, version, state badge (Idle/Running/Stopped/Error).
- Start/Stop buttons to trigger or halt script execution.
- Success rate percentage computed from `ScriptRunRecords`.
- "Details" link navigates to the script's detail page.

### ScriptDetail (Dynamic Form + Logs)

Route: `/script/{ScriptName}`

- **Dynamic Settings Form**: Reads `ScriptMetadata.Settings` and auto-renders:
  - `Text` -> text input
  - `Number` -> number input with min/max
  - `Toggle` -> switch checkbox
  - `Slider` -> range input with current value badge
- Settings are persisted to SQLite on save.
- **Live Log Console**: Connects to SignalR `/hubs/log` hub. Displays timestamped, color-coded log entries (Info=cyan, Warning=yellow, Error=red). Dark terminal-style background.

### Settings

Route: `/settings`

- Displays current Ollama API URL, plugin directory path, and Gmail OAuth instructions.
- Read-only display of values from `appsettings.json` / environment variables.

## Services

### OllamaClient

`IOllamaClient` implementation that sends HTTP POST requests to Ollama's `/api/generate` endpoint. Includes descriptive error messages for connection failures and non-success status codes.

### ScriptHubService

Orchestrates script execution from the UI layer:

- `RunScriptAsync` -- Loads settings from DB, executes the script, records the run result.
- `SaveSettingsAsync` -- Upserts per-script settings to SQLite.
- `GetSuccessRatesAsync` -- Computes success percentages grouped by script name.

### LogBroadcastService

Singleton service that accepts `LogEntry` objects and broadcasts them to all connected SignalR clients. Maintains a rolling buffer of the most recent 500 entries.

## Database

SQLite database auto-created on startup at the path configured in `ConnectionStrings:DefaultConnection`.

| Table              | Fields                                                         |
| ------------------ | -------------------------------------------------------------- |
| `ScriptRunRecords` | Id, ScriptName, StartedAt, CompletedAt, Success, ResultMessage |
| `ScriptSettings`   | Id, ScriptName, Key, Value (unique index on ScriptName + Key)  |

## Configuration

See the root-level [SETUP.md](../../SETUP.md) for full configuration reference. Key settings in `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=/app/config/smartscript.db"
  },
  "Ollama": {
    "BaseUrl": "http://localhost:11434"
  },
  "PluginDirectory": "/app/plugins"
}
```

The environment variable `OLLAMA_BASE_URL` overrides `Ollama:BaseUrl` when set.
