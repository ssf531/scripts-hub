using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartScript.Core.Models;
using SmartScript.Core.Services;
using SmartScript.Api.Data;
using SmartScript.Api.Data.Entities;
using SmartScript.Api.Hubs;

namespace SmartScript.Api.Services;

public interface IAiTaskQueue
{
    Task<int> EnqueueAsync(string type, string description, string prompt, string model, CancellationToken ct = default);
}

public class AiTaskQueueService : BackgroundService, IAiTaskQueue
{
    private readonly Channel<int> _channel = Channel.CreateUnbounded<int>(new UnboundedChannelOptions { SingleReader = true });
    private readonly IServiceProvider _serviceProvider;
    private readonly LogBroadcastService _logBroadcast;
    private readonly IHubContext<LogHub> _hubContext;

    private const string LogSource = "AI Queue";

    public AiTaskQueueService(
        IServiceProvider serviceProvider,
        LogBroadcastService logBroadcast,
        IHubContext<LogHub> hubContext)
    {
        _serviceProvider = serviceProvider;
        _logBroadcast = logBroadcast;
        _hubContext = hubContext;
    }

    // ── IAiTaskQueue ──────────────────────────────────────────────────────────

    public async Task<int> EnqueueAsync(string type, string description, string prompt, string model, CancellationToken ct = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var task = new AiTask
        {
            Type        = type,
            Description = description,
            Prompt      = prompt,
            Model       = model,
            Status      = AiTaskStatus.Pending,
            CreatedAt   = DateTime.UtcNow,
        };
        db.AiTasks.Add(task);
        await db.SaveChangesAsync(ct);

        await _channel.Writer.WriteAsync(task.Id, ct);

        await Log($"Task #{task.Id} queued: {type} ({model})");
        await NotifyUpdated(task.Id, AiTaskStatus.Pending);

        return task.Id;
    }

    // ── BackgroundService ─────────────────────────────────────────────────────

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // On startup, requeue any tasks that were Pending or Running when the app last stopped
        await RequeueIncompleteTasksAsync(stoppingToken);

        await foreach (var taskId in _channel.Reader.ReadAllAsync(stoppingToken))
        {
            await ProcessTaskAsync(taskId, stoppingToken);
        }
    }

    private async Task RequeueIncompleteTasksAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            // Ensure the AiTasks table exists (in case EnsureCreatedAsync didn't run yet)
            await db.Database.EnsureCreatedAsync(ct);

            var incomplete = await db.AiTasks
                .Where(t => t.Status == AiTaskStatus.Pending || t.Status == AiTaskStatus.Running)
                .OrderBy(t => t.Id)
                .Select(t => t.Id)
                .ToListAsync(ct);

            foreach (var id in incomplete)
                await _channel.Writer.WriteAsync(id, ct);

            if (incomplete.Count > 0)
                await Log($"Requeued {incomplete.Count} incomplete task(s) from previous session.");
        }
        catch (Exception ex)
        {
            await Log($"Error requeuing tasks on startup: {ex.Message}", isError: true);
        }
    }

    private async Task ProcessTaskAsync(int taskId, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db     = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var ollama = scope.ServiceProvider.GetRequiredService<IOllamaClient>();

        var task = await db.AiTasks.FindAsync([taskId], ct);
        if (task is null) return;

        // Mark running
        task.Status    = AiTaskStatus.Running;
        task.StartedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await NotifyUpdated(taskId, AiTaskStatus.Running);
        await Log($"Task #{taskId} started: {task.Description}");

        try
        {
            task.Output      = await ollama.GenerateAsync(task.Prompt, task.Model, ct);
            task.Status      = AiTaskStatus.Completed;
            task.CompletedAt = DateTime.UtcNow;

            var duration = (task.CompletedAt - task.StartedAt)?.TotalSeconds ?? 0;
            await Log($"Task #{taskId} completed in {duration:F0}s");
        }
        catch (Exception ex)
        {
            task.Status       = AiTaskStatus.Failed;
            task.ErrorMessage = ex.Message;
            task.CompletedAt  = DateTime.UtcNow;
            await Log($"Task #{taskId} FAILED: {ex.Message}", isError: true);
        }

        await db.SaveChangesAsync(ct);
        await NotifyUpdated(taskId, task.Status);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task Log(string message, bool isError = false) =>
        _logBroadcast.BroadcastAsync(new LogEntry
        {
            ScriptName = LogSource,
            Message    = message,
            Level      = isError ? SmartScript.Core.Models.LogLevel.Error : SmartScript.Core.Models.LogLevel.Info,
            Timestamp  = DateTime.UtcNow,
        });

    private Task NotifyUpdated(int taskId, string status) =>
        _hubContext.Clients.All.SendAsync("AiTaskUpdated", new { taskId, status });
}
