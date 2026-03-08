# SmartScript.Executor

Background services for script lifecycle management, Quartz.NET scheduling, and plugin hot-loading.

## Contents

```
SmartScript.Executor/
├── ScriptManager.cs              # Thread-safe script registry
├── ScriptExecutorService.cs      # BackgroundService: bootstrap + plugin watcher
├── PluginLoader.cs               # AssemblyLoadContext-based plugin loader
└── Scheduling/
    ├── QuartzSchedulerService.cs  # Cron-based script scheduling
    └── ScriptJob.cs               # Quartz IJob that executes a script
```

## Dependencies

| Package                                   | Version | Purpose                      |
| ----------------------------------------- | ------- | ---------------------------- |
| Quartz                                    | 3.16.1  | Job scheduling engine        |
| Quartz.Extensions.Hosting                 | 3.16.1  | Hosted service integration   |
| Microsoft.Extensions.Hosting.Abstractions | 10.0.3  | BackgroundService base class |

**Project reference**: SmartScript.Core

## Components

### ScriptManager

Thread-safe singleton that maintains the registry of all known scripts using `ConcurrentDictionary`.

| Method          | Description                                       |
| --------------- | ------------------------------------------------- |
| `Register`      | Add a script to the registry (sets state to Idle) |
| `Unregister`    | Remove a script and cancel if running             |
| `GetScript`     | Retrieve a script by name                         |
| `GetAllScripts` | List all registered scripts                       |
| `GetState`      | Get current state of a script                     |
| `SetState`      | Update script state                               |
| `StartTracking` | Create a CancellationTokenSource, set Running     |
| `StopTracking`  | Cancel the token, set Stopped                     |

### ScriptExecutorService

A `BackgroundService` that runs at startup to:

1. Register all built-in `IScript` implementations from DI.
2. Load plugin scripts from the configured plugin directory via `PluginLoader`.
3. Schedule all scripts that have a `CronExpression` via `QuartzSchedulerService`.
4. Start a `FileSystemWatcher` on the plugin directory to hot-load new `.dll` files.

### PluginLoader

Implements `IScriptLoader` using `AssemblyLoadContext` for isolated, collectible assembly loading.

- Scans a directory for `.dll` files.
- Each DLL is loaded in its own `AssemblyLoadContext` (collectible) for isolation.
- Discovers all types implementing `IScript` and instantiates them.
- Supports `Unload` to release an assembly context by script name.
- Exposes `PluginDirectory` property for the `FileSystemWatcher`.

### QuartzSchedulerService

Manages Quartz.NET job scheduling for scripts.

- `ScheduleScriptAsync` -- Creates a Quartz job + cron trigger from `ScriptMetadata.CronExpression`.
- `UnscheduleScriptAsync` -- Removes a scheduled job by script name.
- Validates cron expressions and logs next-fire times.

### ScriptJob

A Quartz `IJob` implementation that:

1. Reads `ScriptName` from the job data map.
2. Resolves the script from `ScriptManager`.
3. Skips execution if the script is already running.
4. Calls `ExecuteAsync` and updates the state accordingly.
