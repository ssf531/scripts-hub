namespace SmartScript.WebUI.Data.Entities;

public class ScriptRunRecord
{
    public int Id { get; set; }
    public required string ScriptName { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public bool Success { get; set; }
    public string ResultMessage { get; set; } = string.Empty;
}
