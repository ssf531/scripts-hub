using Microsoft.Extensions.Logging;
using Quartz;
using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;

namespace SmartScript.Executor.Scheduling;

public class ScriptJob : IJob
{
    private readonly ScriptManager _scriptManager;
    private readonly ILogger<ScriptJob> _logger;

    public ScriptJob(ScriptManager scriptManager, ILogger<ScriptJob> logger)
    {
        _scriptManager = scriptManager;
        _logger = logger;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var scriptName = context.MergedJobDataMap.GetString("ScriptName");
        if (string.IsNullOrEmpty(scriptName))
        {
            _logger.LogWarning("ScriptJob executed without a ScriptName in JobDataMap. Job key: {Key}. Ensure the job was scheduled with the correct data.", context.JobDetail.Key);
            return;
        }

        var script = _scriptManager.GetScript(scriptName);
        if (script is null)
        {
            _logger.LogWarning("Scheduled script '{ScriptName}' not found in ScriptManager registry. It may have been unloaded.", scriptName);
            return;
        }

        var state = _scriptManager.GetState(scriptName);
        if (state == ScriptState.Running)
        {
            _logger.LogInformation("Script '{ScriptName}' is already running. Skipping scheduled execution.", scriptName);
            return;
        }

        _logger.LogInformation("Scheduled execution starting for script '{ScriptName}'.", scriptName);
        var cts = _scriptManager.StartTracking(scriptName);

        try
        {
            var result = await script.ExecuteAsync(new Dictionary<string, object>(), cts.Token);
            _scriptManager.SetState(scriptName, result.Success ? ScriptState.Idle : ScriptState.Error);
            _logger.LogInformation("Scheduled execution completed for '{ScriptName}': {Message}", scriptName, result.Message);
        }
        catch (OperationCanceledException)
        {
            _scriptManager.SetState(scriptName, ScriptState.Stopped);
            _logger.LogInformation("Scheduled execution cancelled for '{ScriptName}'.", scriptName);
        }
        catch (Exception ex)
        {
            _scriptManager.SetState(scriptName, ScriptState.Error);
            _logger.LogError(ex, "Scheduled execution failed for '{ScriptName}': {Message}", scriptName, ex.Message);
        }
    }
}
