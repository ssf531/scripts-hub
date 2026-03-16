namespace SmartScript.WebUI.Data.Entities;

public class AiTask
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;         // e.g. "PdfValidation", "EmailCleaner"
    public string Description { get; set; } = string.Empty;  // human-readable label
    public string Prompt { get; set; } = string.Empty;       // text sent to Ollama
    public string Model { get; set; } = string.Empty;
    public string Status { get; set; } = AiTaskStatus.Pending;
    public string? Output { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public static class AiTaskStatus
{
    public const string Pending   = "Pending";
    public const string Running   = "Running";
    public const string Completed = "Completed";
    public const string Failed    = "Failed";
}
