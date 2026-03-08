using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;
using SmartScript.WebUI.Data;
using SmartScript.WebUI.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace SmartScript.WebUI.Services;

public class ScriptHubService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly LogBroadcastService _logService;

    public ScriptHubService(IServiceProvider serviceProvider, LogBroadcastService logService)
    {
        _serviceProvider = serviceProvider;
        _logService = logService;
    }

    public async Task<ScriptResult> RunScriptAsync(IScript script, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var record = new ScriptRunRecord
        {
            ScriptName = script.Metadata.Name,
            StartedAt = DateTime.UtcNow
        };
        db.ScriptRunRecords.Add(record);
        await db.SaveChangesAsync(ct);

        await _logService.BroadcastAsync(new LogEntry
        {
            ScriptName = script.Metadata.Name,
            Level = Core.Models.LogLevel.Info,
            Message = $"Starting script '{script.Metadata.Name}'..."
        });

        var settings = await LoadSettingsAsync(db, script.Metadata.Name, script.Metadata.Settings, ct);
        var result = await script.ExecuteAsync(settings, ct);

        record.CompletedAt = DateTime.UtcNow;
        record.Success = result.Success;
        record.ResultMessage = result.Message;
        await db.SaveChangesAsync(ct);

        await _logService.BroadcastAsync(new LogEntry
        {
            ScriptName = script.Metadata.Name,
            Level = result.Success ? Core.Models.LogLevel.Info : Core.Models.LogLevel.Error,
            Message = result.Message
        });

        return result;
    }

    public async Task<Dictionary<string, double>> GetSuccessRatesAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        return await db.ScriptRunRecords
            .Where(r => r.CompletedAt != null)
            .GroupBy(r => r.ScriptName)
            .ToDictionaryAsync(
                g => g.Key,
                g => g.Count(r => r.Success) * 100.0 / g.Count());
    }

    public async Task SaveSettingsAsync(string scriptName, IDictionary<string, string> values)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        foreach (var (key, value) in values)
        {
            var existing = await db.ScriptSettings
                .FirstOrDefaultAsync(s => s.ScriptName == scriptName && s.Key == key);

            if (existing != null)
            {
                existing.Value = value;
            }
            else
            {
                db.ScriptSettings.Add(new ScriptSettingEntity
                {
                    ScriptName = scriptName,
                    Key = key,
                    Value = value
                });
            }
        }

        await db.SaveChangesAsync();
    }

    private static async Task<Dictionary<string, object>> LoadSettingsAsync(
        AppDbContext db, string scriptName, List<SettingDefinition> definitions, CancellationToken ct)
    {
        var saved = await db.ScriptSettings
            .Where(s => s.ScriptName == scriptName)
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        var result = new Dictionary<string, object>();
        foreach (var def in definitions)
        {
            result[def.Key] = saved.TryGetValue(def.Key, out var val) ? val : def.DefaultValue ?? string.Empty;
        }

        return result;
    }
}
