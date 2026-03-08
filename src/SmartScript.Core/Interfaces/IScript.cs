using SmartScript.Core.Models;

namespace SmartScript.Core.Interfaces;

public interface IScript
{
    ScriptMetadata Metadata { get; }
    Task<ScriptResult> ExecuteAsync(IDictionary<string, object> settings, CancellationToken ct);
    Task StopAsync();
}
