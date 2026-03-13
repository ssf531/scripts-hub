using SmartScript.Core.Models;

namespace SmartScript.Core.Services;

public interface IScriptLogger
{
    Task LogAsync(string scriptName, string message, LogLevel level = LogLevel.Info);
}
