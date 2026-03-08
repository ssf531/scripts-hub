namespace SmartScript.Core.Models;

public class ScriptMetadata
{
    public required string Name { get; init; }
    public string Description { get; init; } = string.Empty;
    public string Version { get; init; } = "1.0.0";
    public string Author { get; init; } = string.Empty;
    public string Icon { get; init; } = "bi-gear";
    public string? CronExpression { get; init; }
    public List<SettingDefinition> Settings { get; init; } = [];
}
