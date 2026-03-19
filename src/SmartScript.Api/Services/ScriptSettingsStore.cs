using Microsoft.EntityFrameworkCore;
using SmartScript.Api.Data;
using SmartScript.Api.Data.Entities;
using SmartScript.Core.Services;

namespace SmartScript.Api.Services;

public class ScriptSettingsStore(IServiceProvider serviceProvider) : IScriptSettingsStore
{
    public async Task<string> GetSettingAsync(string scriptName, string key, string defaultValue = "", CancellationToken ct = default)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var entity = await db.ScriptSettings
            .FirstOrDefaultAsync(s => s.ScriptName == scriptName && s.Key == key, ct);
        return entity?.Value ?? defaultValue;
    }

    public async Task SetSettingAsync(string scriptName, string key, string value, CancellationToken ct = default)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var existing = await db.ScriptSettings
            .FirstOrDefaultAsync(s => s.ScriptName == scriptName && s.Key == key, ct);
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
        await db.SaveChangesAsync(CancellationToken.None); // always persist even if caller's token was cancelled
    }
}
