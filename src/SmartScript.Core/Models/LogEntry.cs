namespace SmartScript.Core.Models;

public class LogEntry
{
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public LogLevel Level { get; init; } = LogLevel.Info;
    public required string Message { get; init; }
    public required string ScriptName { get; init; }
}
