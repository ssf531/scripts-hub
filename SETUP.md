# Setup & Run Guide

## Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 18+](https://nodejs.org/) (for building the React frontend)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for containerized deployment)
- [Ollama](https://ollama.com/) running locally (for AI features)
- A Google Cloud project with Gmail API enabled (for the Email Cleaner script)

---

## Local Development

### 1. Clone and restore

```bash
cd c:\Dev\AITools\ScriptProject
dotnet restore SmartScriptHub.slnx
```

### 2. Configure appsettings for local dev

Edit `src/SmartScript.WebUI/appsettings.Development.json` to override paths for your machine:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=smartscript.db"
  },
  "Ollama": {
    "BaseUrl": "http://localhost:11434",
    "DefaultModel": "llama3.2"
  },
  "CredentialPath": ".",
  "PluginDirectory": "./plugins"
}
```

The default `appsettings.json` uses Docker container paths (`/app/config`, `/app/plugins`).
For local development, the overrides above use relative paths instead.

### 3. Start Ollama

```bash
ollama serve
ollama pull llama3.2
```

### 4. Install frontend dependencies and build

```bash
cd src/SmartScript.WebUI/ClientApp
npm install
npm run build
cd ../../..
```

This builds the React app into `ClientApp/dist/`. The output is served as static files by the ASP.NET backend.

### 5. Build and run

```bash
dotnet build SmartScriptHub.slnx
dotnet run --project src/SmartScript.WebUI
```

The app launches at:

- **HTTP**: http://localhost:5220
- **HTTPS**: https://localhost:7205

### 6. (Optional) Frontend hot reload

For frontend development with hot reload, run the Vite dev server alongside the backend:

```bash
# Terminal 1: Start the backend
dotnet run --project src/SmartScript.WebUI

# Terminal 2: Start Vite dev server
cd src/SmartScript.WebUI/ClientApp
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` and `/hubs` requests to the ASP.NET backend.

### 7. (Optional) Gmail OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials.
2. Create an OAuth 2.0 Client ID (Desktop application type).
3. Download the `credentials.json` file.
4. Place it in the config directory:
   - Local: project root or working directory
   - Docker: `./config/credentials.json`
5. On first run of the Email Cleaner script, a browser window opens to authorize Gmail access. The token is saved automatically.

---

## Docker Deployment

### Prerequisites

1. **Docker Desktop** must be installed and **running** (check the system tray icon on Windows).
2. Docker Desktop should be configured to use the **WSL 2 backend** (Settings > General > "Use the WSL 2 based engine"). This is the default on modern installations.
3. Verify Docker is working:

```powershell
docker --version
docker compose version
```

Both commands should print version numbers. If `docker compose` is not found, you may have an older Docker Desktop -- update it or use `docker-compose` (with a hyphen) instead.

### 1. Prepare host directories

The container needs writable directories on the host for persistent data. Create them before starting:

```powershell
# From the project root
mkdir config, downloads, plugins -Force
```

### 2. Review docker-compose.yml

Before building, review `docker-compose.yml` and adjust paths for your system:

```yaml
volumes:
  - ./config:/app/config         # OAuth tokens, SQLite DB, settings
  - ./downloads:/app/downloads   # Files downloaded by scripts (see note below)
  - ./plugins:/app/plugins       # Drop-in .dll plugins
```

> **Note**: The default `downloads` mount is `./downloads` (relative to the project). To map a specific folder on your machine (e.g. `D:/Downloads/Auto` on Windows), edit the line:
> ```yaml
> - D:/Downloads/Auto:/app/downloads
> ```
> Use forward slashes even on Windows. Docker Desktop handles the path translation.

### 3. Build and run

```powershell
cd c:\Dev\AITools\ScriptProject
docker compose up --build
```

The first build takes a few minutes (installs Node.js, restores NuGet packages, builds the React frontend). Subsequent builds are faster due to Docker layer caching.

The app is available at **http://localhost:5000**.

To run in the background (detached mode):

```powershell
docker compose up --build -d
```

To view logs when running detached:

```powershell
docker compose logs -f
```

To stop:

```powershell
docker compose down
```

### 4. Volume mounts

| Container Path   | Host Path (default) | Purpose                                 |
| ---------------- | ------------------- | --------------------------------------- |
| `/app/config`    | `./config`          | OAuth tokens, SQLite database, settings |
| `/app/downloads` | `./downloads`       | Files downloaded by scripts             |
| `/app/plugins`   | `./plugins`         | Drop-in `.dll` plugin directory         |

### 5. Ollama connectivity

The container uses `host.docker.internal` to reach Ollama on the host machine. This works out of the box on Windows and macOS. On Linux, you may need to add `--network host` or configure the gateway IP manually.

The environment variable `OLLAMA_BASE_URL` in `docker-compose.yml` controls this:

```yaml
environment:
  - OLLAMA_BASE_URL=http://host.docker.internal:11434
```

Make sure Ollama is running on the host (`ollama serve`) before starting the container.

### Troubleshooting

| Problem | Solution |
| ------- | -------- |
| `docker compose` not recognized | Update Docker Desktop, or use `docker-compose` (hyphen) |
| Build fails at `dotnet restore` | Check internet connection; NuGet needs to download packages |
| Build fails at `npm ci` | `.dockerignore` should exclude `node_modules/` -- check it exists |
| Container starts but port 5000 not reachable | Check Docker Desktop is running; check no other service uses port 5000 |
| "connection refused" to Ollama | Ensure `ollama serve` is running on the host before starting the container |
| Permission denied on volume mounts | On Linux: ensure the directories are owned by your user. On Windows: Docker Desktop may prompt for folder sharing permission |
| Live logs show "connection failed" | An ad blocker (e.g. AdGuard) may block the SignalR `/hubs/log` endpoint. Whitelist the app's URL in your ad blocker settings |
| Email test says "no OAuth token" | Run the Email Cleaner script once -- a Google consent screen will open in your browser. Approve access to generate the token |

---

## Local vs Docker Differences

| Aspect              | Local Development                                          | Docker                                                         |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Frontend build      | Manual: `npm install && npm run build` in `ClientApp/`     | Automatic: runs during `docker-compose up --build`             |
| Frontend dev server | Optional: `npm run dev` for hot reload on port 5173        | Not available (production build only)                          |
| App URL             | http://localhost:5220                                      | http://localhost:5000                                          |
| Ollama URL          | `http://localhost:11434` (direct)                          | `http://host.docker.internal:11434` (via Docker network)       |
| Database path       | Relative path (e.g. `smartscript.db`) via appsettings.Development.json | `/app/config/smartscript.db` via bind mount          |
| Gmail credentials   | Project root or working directory                          | `./config/credentials.json` mapped to `/app/config/`           |
| Plugin directory    | `./plugins` (relative)                                     | `./plugins` mapped to `/app/plugins`                           |
| Downloads           | Not applicable (scripts use local paths directly)          | `./downloads` mapped to `/app/downloads` (customizable)        |
| HTTPS               | Available on https://localhost:7205                        | Not configured (add a reverse proxy for production HTTPS)      |

---

## Plugin Development

To create a custom script plugin:

1. Create a new .NET 9 class library project.
2. Add a reference to `SmartScript.Core`.
3. Implement the `IScript` interface.
4. Build the project and copy the output `.dll` to the plugins directory.

```csharp
using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;

public class MyCustomScript : IScript
{
    public ScriptMetadata Metadata { get; } = new()
    {
        Name = "My Custom Script",
        Description = "Does something useful.",
        Settings = [ /* SettingDefinition entries */ ]
    };

    public async Task<ScriptResult> ExecuteAsync(
        IDictionary<string, object> settings, CancellationToken ct)
    {
        // Your logic here
        return new ScriptResult { Success = true, Message = "Done." };
    }

    public Task StopAsync() => Task.CompletedTask;
}
```

The plugin is auto-discovered at startup, or hot-loaded if dropped in while the app is running.

---

## Configuration Reference

| Setting                    | Source                                        | Default                                  |
| -------------------------- | --------------------------------------------- | ---------------------------------------- |
| Database connection string | `ConnectionStrings:DefaultConnection`         | `Data Source=/app/config/smartscript.db` |
| Ollama API URL             | `OLLAMA_BASE_URL` env var or `Ollama:BaseUrl` | `http://localhost:11434`                 |
| Ollama default model       | `Ollama:DefaultModel`                         | `llama3.2`                               |
| Gmail credential path      | `CredentialPath`                              | `/app/config`                            |
| Plugin directory           | `PluginDirectory`                             | `/app/plugins`                           |

Environment variables take precedence over `appsettings.json` values.
