# Setup & Run Guide

## Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
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
    "BaseUrl": "http://localhost:11434"
  },
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

### 4. Build and run

```bash
dotnet build SmartScriptHub.slnx
dotnet run --project src/SmartScript.WebUI
```

The app launches at:

- **HTTP**: http://localhost:5220
- **HTTPS**: https://localhost:7205

### 5. (Optional) Gmail OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials.
2. Create an OAuth 2.0 Client ID (Desktop application type).
3. Download the `credentials.json` file.
4. Place it in the config directory:
   - Local: project root or working directory
   - Docker: `./config/credentials.json`
5. On first run of the Email Cleaner script, a browser window opens to authorize Gmail access. The token is saved automatically.

---

## Docker Deployment

### 1. Build and run with Docker Compose

```bash
cd c:\Dev\AITools\ScriptProject
docker-compose up --build
```

The app is available at **http://localhost:5000**.

### 2. Volume mounts

| Container Path   | Host Path (default) | Purpose                                 |
| ---------------- | ------------------- | --------------------------------------- |
| `/app/config`    | `./config`          | OAuth tokens, SQLite database, settings |
| `/app/downloads` | `D:/Downloads/Auto` | Files downloaded by scripts             |
| `/app/plugins`   | `./plugins`         | Drop-in `.dll` plugin directory         |

Edit `docker-compose.yml` to change the host paths as needed.

### 3. Ollama connectivity

The container uses `host.docker.internal` to reach Ollama on the host machine. This works out of the box on Windows and macOS. On Linux, you may need to add `--network host` or configure the gateway IP manually.

The environment variable `OLLAMA_BASE_URL` in `docker-compose.yml` controls this:

```yaml
environment:
  - OLLAMA_BASE_URL=http://host.docker.internal:11434
```

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
| Plugin directory           | `PluginDirectory`                             | `/app/plugins`                           |

Environment variables take precedence over `appsettings.json` values.
