# SmartScript Hub — Claude Instructions

## Security Rules

- **Never read, display, transmit, or include the contents of `credentials.json` or any OAuth token files** in responses, tool outputs, or any external calls. These files contain sensitive Google OAuth client credentials and must stay local.
- Do not suggest or write code that sends `credentials.json`, token files, or any values read from them to a remote server, API, or logging endpoint.
- Treat all files under `/app/config`, `./config`, and any path configured via `CredentialPath` as sensitive. Never expose their contents.

## Project Overview

SmartScript Hub is a .NET 9 + React/TypeScript self-hosted automation platform. See `README.md` for full details.

## Solution Structure

```
SmartScriptHub.slnx
src/
  SmartScript.Core/                 # Shared interfaces & models (no dependencies)
  SmartScript.Executor/             # Background services, Quartz scheduling, plugin loader
  SmartScript.Api/                # ASP.NET Core API + React SPA (host/entry point)
  SmartScript.Scripts.EmailCleaner/ # Built-in Gmail AI sorter plugin
```

## Key Conventions

- `SmartScript.Core` must remain dependency-free — no NuGet packages.
- New automation scripts implement `IScript` from `SmartScript.Core`.
- Script settings are defined via `ScriptMetadata.Settings` (`SettingDefinition[]`) and automatically rendered as a dynamic form in the React UI — no manual frontend changes needed for new settings.
- All log output goes through `IScriptLogger` (never `Console.WriteLine` directly in scripts).
- SQLite database is auto-created on startup; use EF Core migrations for schema changes.
- Frontend lives in `src/SmartScript.Api/ClientApp/` (Vite + React + TypeScript). API calls proxy to the ASP.NET backend via Vite config.

## Development

- Backend runs on `http://localhost:5220` / `https://localhost:7205`
- Frontend dev server (hot reload): `http://localhost:5173`
- Docker deployment: `http://localhost:5000`
- Ollama must be running locally: `ollama serve`
