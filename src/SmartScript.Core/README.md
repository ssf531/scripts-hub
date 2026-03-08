# SmartScript.Core

Shared contracts and models library for the SmartScript Hub platform. This project has **zero external dependencies** and defines all the interfaces and data types that other projects depend on.

## Contents

```
SmartScript.Core/
├── Interfaces/
│   ├── IScript.cs            # Core script contract
│   └── IScriptLoader.cs      # Plugin loader contract
├── Models/
│   ├── ScriptMetadata.cs     # Script descriptor (name, version, settings, cron)
│   ├── ScriptResult.cs       # Execution outcome
│   ├── ScriptState.cs        # Enum: Idle, Running, Stopped, Error
│   ├── SettingDefinition.cs  # Single configurable setting descriptor
│   ├── SettingType.cs        # Enum: Text, Number, Toggle, Slider
│   ├── LogEntry.cs           # Timestamped log message
│   └── LogLevel.cs           # Enum: Info, Warning, Error
└── Services/
    └── IOllamaClient.cs      # Ollama AI generation contract
```

## Key Interfaces

### IScript

The central contract every automation script must implement.

```csharp
public interface IScript
{
    ScriptMetadata Metadata { get; }
    Task<ScriptResult> ExecuteAsync(IDictionary<string, object> settings, CancellationToken ct);
    Task StopAsync();
}
```

- `Metadata` -- Describes the script (name, description, version, settings schema, optional cron).
- `ExecuteAsync` -- Runs the script logic with user-configured settings and a cancellation token.
- `StopAsync` -- Signals the script to gracefully stop.

### IScriptLoader

Used by the plugin system to discover `IScript` implementations from external assemblies.

```csharp
public interface IScriptLoader
{
    IReadOnlyList<IScript> LoadScripts();
    IReadOnlyList<IScript> LoadFromDirectory(string pluginDirectory);
    void Unload(string scriptName);
}
```

### IOllamaClient

Abstraction for local AI text generation via Ollama.

```csharp
public interface IOllamaClient
{
    Task<string> GenerateAsync(string prompt, string model, CancellationToken ct);
}
```

## Models

| Model               | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `ScriptMetadata`    | Name, Description, Version, Author, Icon, CronExpression, Settings  |
| `ScriptResult`      | Success flag, message, timestamp, arbitrary details dictionary      |
| `ScriptState`       | Lifecycle state enum (Idle / Running / Stopped / Error)             |
| `SettingDefinition` | Key, DisplayName, Type, DefaultValue, Min, Max for dynamic UI forms |
| `SettingType`       | Input type enum (Text / Number / Toggle / Slider)                   |
| `LogEntry`          | Timestamp, Level, Message, ScriptName for real-time log streaming   |

## Usage

This project is referenced by all other projects in the solution. It should remain a pure abstractions library with no external NuGet dependencies.
