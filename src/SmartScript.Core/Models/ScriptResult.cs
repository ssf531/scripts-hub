namespace SmartScript.Core.Models;

public class ScriptResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public Dictionary<string, object> Details { get; init; } = [];
}
