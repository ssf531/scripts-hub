using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartScript.Core.Models;
using SmartScript.Executor;
using SmartScript.Api.Data;
using SmartScript.Api.Services;

namespace SmartScript.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScriptsController : ControllerBase
{
    private readonly ScriptManager _scriptManager;
    private readonly ScriptHubService _hubService;
    private readonly IServiceProvider _serviceProvider;

    public ScriptsController(ScriptManager scriptManager, ScriptHubService hubService, IServiceProvider serviceProvider)
    {
        _scriptManager = scriptManager;
        _hubService = hubService;
        _serviceProvider = serviceProvider;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var scripts = _scriptManager.GetAllScripts();

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var allSaved = await db.ScriptSettings.ToListAsync();
        var savedByScript = allSaved
            .GroupBy(s => s.ScriptName)
            .ToDictionary(g => g.Key, g => g.ToDictionary(s => s.Key, s => s.Value));

        var result = scripts.Select(s =>
        {
            savedByScript.TryGetValue(s.Metadata.Name, out var savedDict);
            return new
            {
                s.Metadata.Name,
                s.Metadata.Description,
                s.Metadata.Version,
                s.Metadata.Author,
                s.Metadata.Icon,
                s.Metadata.CronExpression,
                Settings = s.Metadata.Settings.Select(st => new
                {
                    st.Key,
                    st.DisplayName,
                    Type = st.Type.ToString().ToLowerInvariant(),
                    st.DefaultValue,
                    SavedValue = savedDict?.GetValueOrDefault(st.Key),
                    st.Min,
                    st.Max
                }),
                State = _scriptManager.GetState(s.Metadata.Name).ToString().ToLowerInvariant()
            };
        });
        return Ok(result);
    }

    [HttpGet("success-rates")]
    public async Task<IActionResult> GetSuccessRates()
    {
        var rates = await _hubService.GetSuccessRatesAsync();
        return Ok(rates);
    }

    [HttpGet("{name}")]
    public async Task<IActionResult> GetByName(string name)
    {
        var script = _scriptManager.GetScript(name);
        if (script is null)
            return NotFound(new { message = $"Script '{name}' not found." });

        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var savedDict = await db.ScriptSettings
            .Where(s => s.ScriptName == name)
            .ToDictionaryAsync(s => s.Key, s => s.Value);

        var result = new
        {
            script.Metadata.Name,
            script.Metadata.Description,
            script.Metadata.Version,
            script.Metadata.Author,
            script.Metadata.Icon,
            script.Metadata.CronExpression,
            Settings = script.Metadata.Settings.Select(st => new
            {
                st.Key,
                st.DisplayName,
                Type = st.Type.ToString().ToLowerInvariant(),
                st.DefaultValue,
                SavedValue = savedDict.GetValueOrDefault(st.Key),
                st.Min,
                st.Max
            }),
            State = _scriptManager.GetState(script.Metadata.Name).ToString().ToLowerInvariant()
        };
        return Ok(result);
    }

    [HttpPost("{name}/run")]
    public async Task<IActionResult> Run(string name)
    {
        var script = _scriptManager.GetScript(name);
        if (script is null)
            return NotFound(new { message = $"Script '{name}' not found." });

        var cts = _scriptManager.StartTracking(name);
        try
        {
            var result = await _hubService.RunScriptAsync(script, cts.Token);
            _scriptManager.SetState(name, ScriptState.Idle);
            return Ok(new
            {
                result.Success,
                result.Message,
                State = _scriptManager.GetState(name).ToString().ToLowerInvariant()
            });
        }
        catch (OperationCanceledException)
        {
            return Ok(new
            {
                Success = false,
                Message = "Script was stopped.",
                State = _scriptManager.GetState(name).ToString().ToLowerInvariant()
            });
        }
        catch (Exception ex)
        {
            _scriptManager.SetState(name, ScriptState.Error);
            return Ok(new
            {
                Success = false,
                Message = ex.Message,
                State = _scriptManager.GetState(name).ToString().ToLowerInvariant()
            });
        }
    }

    [HttpPost("{name}/stop")]
    public IActionResult Stop(string name)
    {
        var script = _scriptManager.GetScript(name);
        if (script is null)
            return NotFound(new { message = $"Script '{name}' not found." });

        _scriptManager.StopTracking(name);
        _ = script.StopAsync();
        return Ok(new
        {
            Success = true,
            State = _scriptManager.GetState(name).ToString().ToLowerInvariant()
        });
    }

    [HttpPost("{name}/settings")]
    public async Task<IActionResult> SaveSettings(string name, [FromBody] Dictionary<string, string> settings)
    {
        var script = _scriptManager.GetScript(name);
        if (script is null)
            return NotFound(new { message = $"Script '{name}' not found." });

        await _hubService.SaveSettingsAsync(name, settings);
        return Ok(new { success = true, message = "Settings saved." });
    }
}
