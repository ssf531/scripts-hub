using SmartScript.Core.Interfaces;
using SmartScript.Executor.Scheduling;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SmartScript.Executor;

public class ScriptExecutorService : BackgroundService
{
    private readonly ScriptManager _scriptManager;
    private readonly IServiceProvider _serviceProvider;
    private readonly IScriptLoader _scriptLoader;
    private readonly ILogger<ScriptExecutorService> _logger;
    private FileSystemWatcher? _pluginWatcher;

    public ScriptExecutorService(
        ScriptManager scriptManager,
        IServiceProvider serviceProvider,
        IScriptLoader scriptLoader,
        ILogger<ScriptExecutorService> logger)
    {
        _scriptManager = scriptManager;
        _serviceProvider = serviceProvider;
        _scriptLoader = scriptLoader;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Register built-in scripts from DI
        using (var scope = _serviceProvider.CreateScope())
        {
            var scripts = scope.ServiceProvider.GetServices<IScript>();
            foreach (var script in scripts)
            {
                _scriptManager.Register(script);
                _logger.LogInformation("Registered built-in script: {Name}", script.Metadata.Name);
            }
        }

        // Load plugins
        try
        {
            var plugins = _scriptLoader.LoadScripts();
            foreach (var plugin in plugins)
            {
                _scriptManager.Register(plugin);
                _logger.LogInformation("Registered plugin script: {Name}", plugin.Metadata.Name);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load plugin scripts. Continuing with built-in scripts only.");
        }

        // Schedule all scripts with cron expressions
        await ScheduleAllScriptsAsync();

        // Watch plugin directory for hot-loading
        StartPluginWatcher();

        // Keep alive until shutdown
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Graceful shutdown
        }
    }

    private async Task ScheduleAllScriptsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var schedulerService = scope.ServiceProvider.GetService<QuartzSchedulerService>();
        if (schedulerService is null) return;

        foreach (var script in _scriptManager.GetAllScripts())
        {
            if (!string.IsNullOrWhiteSpace(script.Metadata.CronExpression))
            {
                await schedulerService.ScheduleScriptAsync(script);
            }
        }
    }

    private void StartPluginWatcher()
    {
        var pluginDir = (_scriptLoader as PluginLoader)?.PluginDirectory;
        if (pluginDir is null || !Directory.Exists(pluginDir)) return;

        _pluginWatcher = new FileSystemWatcher(pluginDir, "*.dll")
        {
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.CreationTime,
            EnableRaisingEvents = true
        };

        _pluginWatcher.Created += OnPluginFileChanged;
        _pluginWatcher.Changed += OnPluginFileChanged;

        _logger.LogInformation("Watching plugin directory '{Dir}' for new .dll files.", pluginDir);
    }

    private void OnPluginFileChanged(object sender, FileSystemEventArgs e)
    {
        _logger.LogInformation("Plugin file change detected: {Path}. Reloading plugins.", e.FullPath);

        // Small delay to let file write complete
        Task.Delay(1000).ContinueWith(_ =>
        {
            try
            {
                var newScripts = _scriptLoader.LoadFromDirectory(Path.GetDirectoryName(e.FullPath)!);
                foreach (var script in newScripts)
                {
                    _scriptManager.Register(script);
                    _logger.LogInformation("Hot-loaded plugin script: {Name}", script.Metadata.Name);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to hot-load plugin from '{Path}': {Message}", e.FullPath, ex.Message);
            }
        });
    }

    public override void Dispose()
    {
        _pluginWatcher?.Dispose();
        base.Dispose();
    }
}
