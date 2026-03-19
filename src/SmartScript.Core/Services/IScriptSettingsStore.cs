namespace SmartScript.Core.Services;

/// <summary>
/// Allows scripts to read and write individual settings from the persistent store while running,
/// enabling dynamic behaviour such as a live download queue that picks up items added by the user.
/// </summary>
public interface IScriptSettingsStore
{
    Task<string> GetSettingAsync(string scriptName, string key, string defaultValue = "", CancellationToken ct = default);
    Task SetSettingAsync(string scriptName, string key, string value, CancellationToken ct = default);
}
