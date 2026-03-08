namespace SmartScript.Core.Models;

public class SettingDefinition
{
    public required string Key { get; init; }
    public required string DisplayName { get; init; }
    public SettingType Type { get; init; } = SettingType.Text;
    public string? DefaultValue { get; init; }
    public double? Min { get; init; }
    public double? Max { get; init; }
}
