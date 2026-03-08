namespace SmartScript.WebUI.Data.Entities;

public class ScriptSettingEntity
{
    public int Id { get; set; }
    public required string ScriptName { get; set; }
    public required string Key { get; set; }
    public string Value { get; set; } = string.Empty;
}
