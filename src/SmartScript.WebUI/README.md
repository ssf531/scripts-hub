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
│       │   ├── History.tsx        # Recent script run records
│       │   ├── ScriptDetail.tsx   # Dispatcher → per-script page component
│       │   ├── Settings.tsx       # Read-only global config
│       │   └── scripts/           # Per-script page components
│       │       ├── shared.tsx              # useScriptPage hook, SettingField, SaveBar
│       │       ├── M3u8DownloaderPage.tsx  # Queue + Diagnostics + Settings layout
│       │       ├── EmailCleanerPage.tsx    # Settings + Ollama/Email diagnostics
│       │       └── GenericScriptPage.tsx   # Fallback for any other script
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

**Project references**: SmartScript.Core, SmartScript.Executor, SmartScript.Scripts.EmailCleaner, SmartScript.Scripts.M3u8Downloader

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

| Method | Route                           | Description                          |
| ------ | ------------------------------- | ------------------------------------ |
| POST   | `/api/diagnostics/test-ollama`  | Test Ollama connection                |
| POST   | `/api/diagnostics/test-email`   | Test Gmail credentials               |
| POST   | `/api/diagnostics/test-m3u8dl`  | Test N_m3u8DL-RE executable (version check) |

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

### ScriptDetail (Dispatcher)

Route: `/script/:name`

`ScriptDetail.tsx` is a thin dispatcher that maps the script name to a dedicated page component. To add a custom UI for a new script, create `pages/scripts/YourScriptPage.tsx` and register one line in the `PAGES` map.

#### M3u8DownloaderPage

- **Download Queue card**: Large textarea for `URL|Filename` entries (one per line). Plain URLs are also accepted — filename is auto-detected.
- **Diagnostics card**: "Test N_m3u8DL-RE" button runs `--version` to confirm the executable is installed and accessible.
- **Settings card**: Compact 3-column grid — Save Directory, Executable Path, Thread Count (slider), Output Format, Extra Arguments.
- **Save Settings**: Single save button below the Settings card saves all settings (queue + config) at once.

#### EmailCleanerPage

- **Settings card** + **Diagnostics card** side by side.
- Diagnostics: Test Ollama connection (lists available models) and Test Email Credentials (checks `credentials.json` + OAuth token with setup instructions).

#### GenericScriptPage

Fallback for any script without a dedicated page. Renders all settings in a single card.

#### Shared setting types (`SettingType` enum)

| Type       | Rendered as                        |
| ---------- | ---------------------------------- |
| `Text`     | `<input type="text">`              |
| `Number`   | `<input type="number">` with min/max |
| `Toggle`   | Bootstrap form switch              |
| `Slider`   | `<input type="range">` with value badge |
| `Textarea` | `<textarea>` (monospace, 10 rows)  |

Settings are persisted to SQLite on save. On page load, the API returns both `defaultValue` (from script metadata / `appsettings.json`) and `savedValue` (from DB); the form shows the saved value when available, falling back to the default.

- **Live Log Console**: Connects to SignalR `/hubs/log` hub filtered by script name. Timestamped, color-coded entries (Info=cyan, Warning=yellow, Error=red). Shows a warning banner if the SignalR connection fails.

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

- `TestOllamaAsync` — Verifies Ollama connectivity and lists available models.
- `TestEmailCredentialsAsync` — Checks for `credentials.json` and OAuth token files at a given path.
- `TestM3u8DLAsync` — Resolves the N_m3u8DL-RE executable from PATH or an absolute path, runs `--version`, and returns the version string.

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
  "PluginDirectory": "/app/plugins",
  "M3u8Downloader": {
    "ExecutablePath": "N_m3u8DL-RE",
    "SaveDir": "",
    "ThreadCount": "6",
    "OutputFormat": "mp4",
    "ExtraArgs": ""
  }
}
```

- `OLLAMA_BASE_URL` env var overrides `Ollama:BaseUrl`.
- `CredentialPath` — directory for Gmail OAuth credentials and tokens.
- `M3u8Downloader:*` — default values for the M3U8 Downloader script settings. These are used when a user hasn't saved custom values yet.

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

The Vite dev server runs on `http://localhost:3000` and proxies `/api` and `/hubs` requests to the ASP.NET backend on port 5220.

### Rebuilding the frontend

After making frontend changes, run `npm run build` from `ClientApp/` to update the backend's static files:

```bash
cd src/SmartScript.WebUI/ClientApp
npm run build
```

Vite outputs directly to `../wwwroot/` (configured via `outDir` in `vite.config.ts`), so port 5220 immediately serves the updated app after a rebuild and server restart.

### Publishing

The csproj `PublishSpa` target runs `npm ci && npm run build` automatically during `dotnet publish`, outputting to `wwwroot/` which is included in the publish output.

## Troubleshooting

| Problem | Solution |
| ------- | -------- |
| Live logs show "connection failed" warning | An ad blocker (e.g. AdGuard) may block the SignalR `/hubs/log` endpoint. Whitelist `localhost:5220` (or your app URL) in ad blocker settings |
| Settings reset to defaults after page reload | Verify the API returns `savedValue` fields (GET `/api/scripts/{name}`) — this was fixed so saved values persist across reloads |
| Email test says "no OAuth token" | Run the Email Cleaner script once to trigger the Google OAuth consent flow in your browser |
| Email test says "credentials.json not found" | Download `credentials.json` from Google Cloud Console > APIs & Services > Credentials (OAuth 2.0 Client ID, Desktop type) and place it in the credential path |
| M3U8 diagnostic says "Executable not found" | Install N_m3u8DL-RE and add it to your PATH, or enter the full absolute path in the script's Executable Path setting |
| Port 5220 shows outdated UI after frontend changes | Run `npm run build` in `ClientApp/` — the output goes to `wwwroot/` and is picked up on next backend start |
