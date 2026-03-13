# SmartScript.Scripts.M3u8Downloader

Built-in plugin that downloads HLS/M3U8 video streams using [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE). Supports a multi-item download queue, runs silently (no terminal window), and captures all output to the live log console.

## Contents

```
SmartScript.Scripts.M3u8Downloader/
└── M3u8DownloaderScript.cs    # IScript implementation
```

## Dependencies

| Package                                          | Version | Purpose                        |
| ------------------------------------------------ | ------- | ------------------------------ |
| Microsoft.Extensions.Configuration.Abstractions | 9.0.0   | Read defaults from appsettings |

**Project reference**: SmartScript.Core

**External tool required**: [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE/releases) — must be in PATH or configured via the `executablePath` setting.

## Workflow

```
1. Parse Queue   -->  Split textarea into (URL, Filename) pairs
2. Resolve Exe   -->  Find N_m3u8DL-RE in PATH or at configured path
3. For each item -->  Run N_m3u8DL-RE silently, stream output to log
4. Report        -->  Return ScriptResult with completed/failed counts
```

## Configurable Settings

Defined in `M3u8DownloaderScript.Metadata.Settings`. Default values are read from `appsettings.json` under the `M3u8Downloader` section, falling back to built-in defaults if not set.

| Key               | Display Name                  | Type     | Default          |
| ----------------- | ----------------------------- | -------- | ---------------- |
| `downloadQueue`   | Download Queue                | Textarea | _(empty)_        |
| `saveDir`         | Save Directory (optional)     | Text     | _(empty)_        |
| `executablePath`  | N_m3u8DL-RE Executable Path   | Text     | `N_m3u8DL-RE`    |
| `threadCount`     | Download Threads              | Slider   | `6` (range 1–32) |
| `outputFormat`    | Output Format (mp4 / mkv / ts)| Text     | `mp4`            |
| `extraArgs`       | Extra Arguments (optional)    | Text     | _(empty)_        |

### Download Queue Format

Each line in the textarea is one download entry:

```
https://example.com/stream.m3u8|My Video Title
https://example.com/other.m3u8|Episode 2
https://example.com/plain.m3u8
```

- `URL|Filename` — explicit output filename (no extension needed)
- `URL` — filename auto-detected from the URL path segment
- Blank lines are ignored

## appsettings.json Defaults

Add a `M3u8Downloader` section to pre-configure defaults without saving from the UI:

```json
"M3u8Downloader": {
  "ExecutablePath": "N_m3u8DL-RE",
  "SaveDir": "D:/Downloads",
  "ThreadCount": "8",
  "OutputFormat": "mkv",
  "ExtraArgs": "--auto-select"
}
```

## Silent Execution

The script runs N_m3u8DL-RE with:
- `UseShellExecute = false` — no terminal window pops up
- `CreateNoWindow = true` — fully background
- `RedirectStandardOutput/Error = true` — all output streamed to the live log console

## N_m3u8DL-RE Setup

1. Download the latest release from [GitHub Releases](https://github.com/nilaoda/N_m3u8DL-RE/releases).
2. Place the executable in your system PATH **or** set the full path in the `executablePath` setting.
3. Use the **Diagnostics** panel on the script page → "Test N_m3u8DL-RE" to verify it's detected correctly.

## Error Handling

- **Empty queue**: Returns failure immediately with an instructional message.
- **Executable not found**: Logs an error and returns failure before attempting any downloads.
- **Individual item failure**: Logs the failure, increments the failed counter, and continues with the next item.
- **Cancellation**: Kills the active process, logs how many items completed before stopping, returns partial results.
