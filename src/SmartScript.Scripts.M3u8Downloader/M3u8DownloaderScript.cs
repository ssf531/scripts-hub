using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;
using SmartScript.Core.Services;
using LogLevel = SmartScript.Core.Models.LogLevel;

namespace SmartScript.Scripts.M3u8Downloader;

public class M3u8DownloaderScript : IScript
{
    private readonly IScriptLogger _logger;
    private CancellationTokenSource? _cts;

    public M3u8DownloaderScript(IScriptLogger logger, IConfiguration configuration)
    {
        _logger = logger;

        var defaultExecutablePath = configuration["M3u8Downloader:ExecutablePath"] ?? "N_m3u8DL-RE";
        var defaultSaveDir        = configuration["M3u8Downloader:SaveDir"]        ?? "";
        var defaultThreadCount    = configuration["M3u8Downloader:ThreadCount"]    ?? "6";
        var defaultOutputFormat   = configuration["M3u8Downloader:OutputFormat"]   ?? "mp4";
        var defaultExtraArgs      = configuration["M3u8Downloader:ExtraArgs"]      ?? "";

        Metadata = new ScriptMetadata
        {
            Name = "M3U8 Video Downloader",
            Description = "Downloads HLS/M3U8 video streams using N_m3u8DL-RE. Add one download per line in the queue (format: URL|Filename). Runs silently with output captured to the log.",
            Version = "1.0.0",
            Author = "SmartScript Hub",
            Icon = "bi-cloud-arrow-down",
            Settings =
            [
                new SettingDefinition
                {
                    Key = "downloadQueue",
                    DisplayName = "Download Queue (one per line: URL|Filename  or just URL)",
                    Type = SettingType.Textarea,
                    DefaultValue = ""
                },
                new SettingDefinition
                {
                    Key = "saveDir",
                    DisplayName = "Save Directory (optional)",
                    Type = SettingType.Text,
                    DefaultValue = defaultSaveDir
                },
                new SettingDefinition
                {
                    Key = "executablePath",
                    DisplayName = "N_m3u8DL-RE Executable Path",
                    Type = SettingType.Text,
                    DefaultValue = defaultExecutablePath
                },
                new SettingDefinition
                {
                    Key = "threadCount",
                    DisplayName = "Download Threads",
                    Type = SettingType.Slider,
                    DefaultValue = defaultThreadCount,
                    Min = 1,
                    Max = 32
                },
                new SettingDefinition
                {
                    Key = "outputFormat",
                    DisplayName = "Output Format (mp4 / mkv / ts)",
                    Type = SettingType.Text,
                    DefaultValue = defaultOutputFormat
                },
                new SettingDefinition
                {
                    Key = "extraArgs",
                    DisplayName = "Extra Arguments (optional)",
                    Type = SettingType.Text,
                    DefaultValue = defaultExtraArgs
                }
            ]
        };
    }

    public ScriptMetadata Metadata { get; }

    public async Task<ScriptResult> ExecuteAsync(IDictionary<string, object> settings, CancellationToken ct)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var token = _cts.Token;

        var queueRaw = GetSetting(settings, "downloadQueue", "");
        var saveDir = GetSetting(settings, "saveDir", "");
        var executablePath = GetSetting(settings, "executablePath", "N_m3u8DL-RE");
        var threadCount = GetSetting(settings, "threadCount", "6");
        var outputFormat = GetSetting(settings, "outputFormat", "mp4");
        var extraArgs = GetSetting(settings, "extraArgs", "");

        // Parse queue entries — keep raw lines in parallel for removal tracking
        var (entries, rawLines) = ParseQueue(queueRaw);
        if (entries.Count == 0)
        {
            return new ScriptResult
            {
                Success = false,
                Message = "Download queue is empty. Add entries in the format: URL|Filename (one per line)."
            };
        }

        // Resolve executable once
        var resolvedExe = ResolveExecutable(executablePath);
        if (resolvedExe is null)
        {
            var msg = $"Executable not found: '{executablePath}'. Ensure N_m3u8DL-RE is installed and in PATH or provide an absolute path.";
            await _logger.LogAsync(Metadata.Name, msg, LogLevel.Error);
            return new ScriptResult { Success = false, Message = msg };
        }

        await _logger.LogAsync(Metadata.Name, $"Starting queue: {entries.Count} item(s) to download.");

        int completed = 0, failed = 0;
        // Track which raw lines have been successfully downloaded (by index)
        var completedIndices = new HashSet<int>();

        for (int i = 0; i < entries.Count; i++)
        {
            token.ThrowIfCancellationRequested();

            var (url, saveName) = entries[i];
            await _logger.LogAsync(Metadata.Name, $"[{i + 1}/{entries.Count}] Downloading: {saveName}");

            try
            {
                bool success = await RunDownloadAsync(resolvedExe, url, saveName, saveDir, threadCount, outputFormat, extraArgs, token);
                if (success)
                {
                    completed++;
                    completedIndices.Add(i);
                    await _logger.LogAsync(Metadata.Name, $"[{i + 1}/{entries.Count}] Completed: {saveName}.{outputFormat}");
                }
                else
                {
                    failed++;
                    await _logger.LogAsync(Metadata.Name, $"[{i + 1}/{entries.Count}] Failed: {saveName}", LogLevel.Error);
                }
            }
            catch (OperationCanceledException)
            {
                failed++;
                var cancelMsg = $"Queue cancelled after {completed} completed, {failed} failed (item {i + 1}/{entries.Count}).";
                await _logger.LogAsync(Metadata.Name, cancelMsg, LogLevel.Warning);
                var remainingOnCancel = BuildRemainingQueue(rawLines, completedIndices);
                return new ScriptResult
                {
                    Success = false,
                    Message = cancelMsg,
                    Details = new Dictionary<string, object> { ["completed"] = completed, ["failed"] = failed },
                    UpdatedSettings = new Dictionary<string, string> { ["downloadQueue"] = remainingOnCancel }
                };
            }
        }

        var resultMsg = completed == entries.Count
            ? $"All {completed} download(s) completed successfully."
            : $"Queue finished: {completed} completed, {failed} failed.";

        await _logger.LogAsync(Metadata.Name, resultMsg, failed > 0 ? LogLevel.Warning : LogLevel.Info);

        var remainingQueue = BuildRemainingQueue(rawLines, completedIndices);
        return new ScriptResult
        {
            Success = failed == 0,
            Message = resultMsg,
            Details = new Dictionary<string, object>
            {
                ["total"] = entries.Count,
                ["completed"] = completed,
                ["failed"] = failed
            },
            UpdatedSettings = new Dictionary<string, string> { ["downloadQueue"] = remainingQueue }
        };
    }

    public Task StopAsync()
    {
        _cts?.Cancel();
        return Task.CompletedTask;
    }

    private async Task<bool> RunDownloadAsync(
        string exe, string url, string saveName, string saveDir,
        string threadCount, string outputFormat, string extraArgs,
        CancellationToken token)
    {
        var args = BuildArguments(url, saveName, saveDir, threadCount, outputFormat, extraArgs);

        var psi = new ProcessStartInfo
        {
            FileName = exe,
            Arguments = args,
            UseShellExecute = false,       // no popup window
            RedirectStandardOutput = true, // capture output silently
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        using var process = new Process { StartInfo = psi, EnableRaisingEvents = true };

        process.OutputDataReceived += async (_, e) =>
        {
            if (e.Data is { Length: > 0 })
                await _logger.LogAsync(Metadata.Name, e.Data);
        };
        process.ErrorDataReceived += async (_, e) =>
        {
            if (e.Data is { Length: > 0 })
                await _logger.LogAsync(Metadata.Name, e.Data, LogLevel.Warning);
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync(token);

        if (token.IsCancellationRequested && !process.HasExited)
        {
            process.Kill(entireProcessTree: true);
            throw new OperationCanceledException(token);
        }

        return process.ExitCode == 0;
    }

    // Matches separators: pipe, tab, " | ", " - ", or 2+ spaces between URL and name
    private static readonly Regex SeparatorRegex =
        new(@"\s*[|\t]\s*|\s{2,}|\s+-\s+", RegexOptions.Compiled);

    /// <summary>
    /// Returns parsed (url, name) entries AND the corresponding raw lines (aligned by index)
    /// so callers can reconstruct the queue after removing completed items.
    /// </summary>
    private static (List<(string Url, string Name)> Entries, List<string> RawLines) ParseQueue(string raw)
    {
        var entries = new List<(string, string)>();
        var rawLines = new List<string>();
        if (string.IsNullOrWhiteSpace(raw)) return (entries, rawLines);

        int autoIndex = 1;
        foreach (var line in raw.Split('\n'))
        {
            var trimmed = line.Trim().TrimEnd('\r');
            if (string.IsNullOrWhiteSpace(trimmed)) continue;

            // Try to split on any supported separator
            var parts = SeparatorRegex.Split(trimmed, 2);
            if (parts.Length == 2)
            {
                var url = parts[0].Trim();
                var name = parts[1].Trim();
                if (!string.IsNullOrWhiteSpace(url) && !string.IsNullOrWhiteSpace(name))
                {
                    entries.Add((url, name));
                    rawLines.Add(trimmed);
                }
            }
            else
            {
                // No name — derive from URL or use auto-index
                var name = DeriveNameFromUrl(trimmed) ?? $"video_{autoIndex}";
                entries.Add((trimmed, name));
                rawLines.Add(trimmed);
                autoIndex++;
            }
        }

        return (entries, rawLines);
    }

    private static string BuildRemainingQueue(List<string> rawLines, HashSet<int> completedIndices)
    {
        var remaining = rawLines
            .Select((line, i) => (line, i))
            .Where(t => !completedIndices.Contains(t.i))
            .Select(t => t.line);
        return string.Join("\n", remaining);
    }

    private static string? DeriveNameFromUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            var segment = uri.Segments.LastOrDefault(s => s != "/")?.TrimEnd('/');
            if (string.IsNullOrWhiteSpace(segment)) return null;
            // Strip extension if present
            var dot = segment.LastIndexOf('.');
            return dot > 0 ? segment[..dot] : segment;
        }
        catch
        {
            return null;
        }
    }

    private static string BuildArguments(
        string url, string saveName, string saveDir,
        string threadCount, string outputFormat, string extraArgs)
    {
        var sb = new StringBuilder();
        sb.Append($"\"{url}\" --save-name \"{saveName}\" --thread-count {threadCount} -M format={outputFormat}");

        if (!string.IsNullOrWhiteSpace(saveDir))
            sb.Append($" --save-dir \"{saveDir}\"");

        if (!string.IsNullOrWhiteSpace(extraArgs))
            sb.Append($" {extraArgs.Trim()}");

        return sb.ToString();
    }

    internal static string? ResolveExecutable(string executablePath)
    {
        if (Path.IsPathRooted(executablePath) || executablePath.Contains(Path.DirectorySeparatorChar) || executablePath.Contains('/'))
            return File.Exists(executablePath) ? executablePath : null;

        var localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, executablePath);
        if (File.Exists(localPath)) return localPath;

        var localExe = localPath + ".exe";
        if (File.Exists(localExe)) return localExe;

        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in pathEnv.Split(Path.PathSeparator))
        {
            try
            {
                var candidate = Path.Combine(dir, executablePath);
                if (File.Exists(candidate)) return candidate;
                var candidateExe = candidate + ".exe";
                if (File.Exists(candidateExe)) return candidateExe;
            }
            catch { }
        }

        return null;
    }

    private static string GetSetting(IDictionary<string, object> settings, string key, string defaultValue) =>
        settings.TryGetValue(key, out var value) ? value?.ToString() ?? defaultValue : defaultValue;
}
