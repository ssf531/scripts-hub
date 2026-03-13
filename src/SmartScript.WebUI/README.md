# SmartScript.WebUI

ASP.NET Core Web API + React SPA host application for SmartScript Hub. This is the entry point that wires together all services, exposes REST API endpoints, and serves the React frontend.

## Contents

```
SmartScript.WebUI/
├── Program.cs                     # DI setup, middleware, startup
├── appsettings.json               # DB connection, Ollama URL, plugin dir
├── Controllers/
│   ├── ScriptsController.cs       # Script CRUD, run/stop, settings
│   ├── DiagnosticsController.cs   # Test Ollama & email connections
│   └── ConfigController.cs        # Global config endpoint
├── ClientApp/                     # React + TypeScript + Vite SPA
│   ├── package.json               # Frontend dependencies
│   ├── vite.config.ts             # Vite config with API proxy
│   ├── tsconfig.json              # TypeScript config
│   ├── index.html                 # SPA entry point
│   └── src/
│       ├── main.tsx               # React entry, router setup
│       ├── App.tsx                # Layout with sidebar nav
│       ├── vite-env.d.ts          # CSS module type declarations
│       ├── types/
│       │   └── index.ts           # TypeScript interfaces
│       ├── api/
│       │   ├── client.ts          # Fetch wrapper
│       │   ├── scripts.ts         # Script API functions
│       │   ├── diagnostics.ts     # Diagnostics API functions
│       │   └── config.ts          # Config API functions
│       ├── hooks/
│       │   └── useLogHub.ts       # SignalR hook for real-time logs
│       ├── pages/
│       │   ├── Dashboard.tsx      # Script cards, start/stop, live logs
│       │   ├── ScriptDetail.tsx   # Settings form, diagnostics, logs
│       │   └── Settings.tsx       # Read-only global config
│       └── components/
│           ├── LogConsole.tsx      # Reusable log display component
│           ├── ScriptCard.tsx      # Individual script card
│           └── Navbar.tsx          # Sidebar navigation
├── Data/
│   ├── AppDbContext.cs            # EF Core DbContext (SQLite)
│   └── Entities/
│       ├── ScriptRunRecord.cs     # Execution history record
│       └── ScriptSettingEntity.cs # Persisted script settings
├── Hubs/
│   └── LogHub.cs                  # SignalR hub for real-time logs
└── Services/
    ├── OllamaClient.cs            # IOllamaClient HTTP impl
    ├── ScriptHubService.cs        # Bridges API to script execution
    ├── LogBroadcastService.cs     # Broadcasts log entries via SignalR
    ├── ScriptLogger.cs            # IScriptLogger impl using LogBroadcastService
    └── TestConnectionService.cs   # Ollama & Gmail connection testing
```

## Backend Dependencies

| Package                              | Version | Purpose                    |
| ------------------------------------ | ------- | -------------------------- |
| Microsoft.EntityFrameworkCore.Sqlite | 9.x     | SQLite database provider   |
| Microsoft.EntityFrameworkCore.Design | 9.x     | EF Core tooling support    |
| Quartz.Extensions.Hosting            | 3.x     | Quartz hosted service + DI |

**Project references**: SmartScript.Core, SmartScript.Executor, SmartScript.Scripts.EmailCleaner

## Frontend Dependencies

Managed via `ClientApp/package.json`:

| Package            | Purpose                             |
| ------------------ | ----------------------------------- |
| react / react-dom  | UI framework                        |
| react-router-dom   | Client-side routing                 |
| @microsoft/signalr | Real-time log streaming via SignalR |
| bootstrap          | CSS framework                       |
| bootstrap-icons    | Icon library                        |
| vite               | Build tool and dev server           |
| typescript         | Type checking                       |

## REST API Endpoints

### ScriptsController

| Method | Route                          | Description                 |
| ------ | ------------------------------ | --------------------------- |
| GET    | `/api/scripts`                 | List all scripts with state |
| GET    | `/api/scripts/success-rates`   | Success rate dictionary     |
| GET    | `/api/scripts/{name}`          | Single script with settings |
| POST   | `/api/scripts/{name}/run`      | Start script execution      |
| POST   | `/api/scripts/{name}/stop`     | Stop a running script       |
| POST   | `/api/scripts/{name}/settings` | Save script settings        |

### DiagnosticsController

| Method | Route                          | Description            |
| ------ | ------------------------------ | ---------------------- |
| POST   | `/api/diagnostics/test-ollama` | Test Ollama connection |
| POST   | `/api/diagnostics/test-email`  | Test Gmail credentials |

### ConfigController

| Method | Route         | Description                            |
| ------ | ------------- | -------------------------------------- |
| GET    | `/api/config` | Global config (Ollama URL, default model, credential path, plugin dir) |

## React Pages

### Dashboard

Route: `/`

- Displays all registered scripts as Bootstrap cards.
- Each card shows: icon, name, description, version, state badge (Idle/Running/Stopped/Error).
- Start/Stop buttons to trigger or halt script execution via REST API.
- Success rate percentage computed from `ScriptRunRecords`.
- "Details" link navigates to the script's detail page.
- Live log panel at the bottom using SignalR.

### ScriptDetail

Route: `/script/:name`

- **Dynamic Settings Form**: Reads `ScriptMetadata.Settings` and auto-renders:
  - `Text` -> text input
  - `Number` -> number input with min/max
  - `Toggle` -> switch checkbox
  - `Slider` -> range input with current value badge
- Settings are persisted to SQLite on save. On page load, the API returns both `defaultValue` and `savedValue` for each setting; the form shows saved values when available, falling back to defaults.
- **Diagnostics Panel**: Test Ollama connection and Gmail credentials. The email test checks for `credentials.json` and an OAuth token file. When the token is missing, step-by-step instructions are shown for completing the OAuth authorization flow.
- **Live Log Console**: Connects to SignalR `/hubs/log` hub filtered by script name. Displays timestamped, color-coded log entries (Info=cyan, Warning=yellow, Error=red). Dark terminal-style background. Shows a warning banner if the SignalR connection fails (e.g. due to an ad blocker).

### Settings

Route: `/settings`

- Displays current Ollama API URL, default model, credential path, and plugin directory.
- Read-only display of values from `appsettings.json` / environment variables.

## Services

### OllamaClient

`IOllamaClient` implementation that sends HTTP POST requests to Ollama's `/api/generate` endpoint. Includes descriptive error messages for connection failures and non-success status codes.

### ScriptHubService

Orchestrates script execution from the API layer:

- `RunScriptAsync` -- Loads settings from DB, executes the script, records the run result.
- `SaveSettingsAsync` -- Upserts per-script settings to SQLite.
- `GetSuccessRatesAsync` -- Computes success percentages grouped by script name.

### LogBroadcastService

Singleton service that accepts `LogEntry` objects and broadcasts them to all connected SignalR clients. Maintains a rolling buffer of the most recent 500 entries. Also exposes an `OnLogReceived` event for in-process subscribers.

### ScriptLogger

`IScriptLogger` implementation that creates `LogEntry` objects and delegates to `LogBroadcastService` for broadcasting.

### TestConnectionService

Provides diagnostic methods:

- `TestOllamaAsync` -- Verifies Ollama connectivity and lists available models.
- `TestEmailAsync` -- Checks for `credentials.json` and OAuth token files at a given path.

## Database

SQLite database auto-created on startup at the path configured in `ConnectionStrings:DefaultConnection`.

| Table              | Fields                                                         |
| ------------------ | -------------------------------------------------------------- |
| `ScriptRunRecords` | Id, ScriptName, StartedAt, CompletedAt, Success, ResultMessage |
| `ScriptSettings`   | Id, ScriptName, Key, Value (unique index on ScriptName + Key)  |

## Configuration

Key settings in `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=/app/config/smartscript.db"
  },
  "Ollama": {
    "BaseUrl": "http://localhost:11434",
    "DefaultModel": "llama3.2"
  },
  "CredentialPath": "/app/config",
  "PluginDirectory": "/app/plugins"
}
```

The environment variable `OLLAMA_BASE_URL` overrides `Ollama:BaseUrl` when set. `Ollama:DefaultModel` sets the default AI model for scripts. `CredentialPath` sets the directory where Gmail OAuth credentials and tokens are stored.

## Development

### Backend only

```bash
cd src/SmartScript.WebUI
dotnet run
```

The backend serves the pre-built React app from `wwwroot/` at `http://localhost:5220`.

### Frontend with hot reload

```bash
# Terminal 1: Start the backend
cd src/SmartScript.WebUI
dotnet run

# Terminal 2: Start Vite dev server
cd src/SmartScript.WebUI/ClientApp
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` and `/hubs` requests to the ASP.NET backend on port 5220.

### Publishing

The csproj includes a `PublishSpa` target that automatically runs `npm ci && npm run build` and copies `ClientApp/dist/` to `wwwroot/` during `dotnet publish`.

## Troubleshooting

| Problem | Solution |
| ------- | -------- |
| Live logs show "connection failed" warning | An ad blocker (e.g. AdGuard) may block the SignalR `/hubs/log` endpoint. Whitelist `localhost:5220` (or your app URL) in ad blocker settings |
| Settings reset to defaults after page reload | Verify the API returns `savedValue` fields (GET `/api/scripts/{name}`) — this was fixed so saved values persist across reloads |
| Email test says "no OAuth token" | Run the Email Cleaner script once to trigger the Google OAuth consent flow in your browser |
| Email test says "credentials.json not found" | Download `credentials.json` from Google Cloud Console > APIs & Services > Credentials (OAuth 2.0 Client ID, Desktop type) and place it in the credential path |
