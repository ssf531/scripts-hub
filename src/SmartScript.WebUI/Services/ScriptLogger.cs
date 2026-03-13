using SmartScript.Core.Services;
using LogLevel = SmartScript.Core.Models.LogLevel;

namespace SmartScript.WebUI.Services;

public class ScriptLogger : IScriptLogger
{
    private readonly LogBroadcastService _logService;

    public ScriptLogger(LogBroadcastService logService)
    {
        _logService = logService;
    }

    public async Task LogAsync(string scriptName, string message, LogLevel level = LogLevel.Info)
    {
        await _logService.BroadcastAsync(new Core.Models.LogEntry
        {
            ScriptName = scriptName,
            Level = level,
            Message = message
        });
    }
}
