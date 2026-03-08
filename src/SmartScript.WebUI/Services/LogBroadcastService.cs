using SmartScript.Core.Models;
using Microsoft.AspNetCore.SignalR;
using SmartScript.WebUI.Hubs;

namespace SmartScript.WebUI.Services;

public class LogBroadcastService
{
    private readonly IHubContext<LogHub> _hubContext;
    private readonly List<LogEntry> _recentLogs = [];
    private readonly Lock _lock = new();
    private const int MaxRecentLogs = 500;

    public LogBroadcastService(IHubContext<LogHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task BroadcastAsync(LogEntry entry)
    {
        lock (_lock)
        {
            _recentLogs.Add(entry);
            if (_recentLogs.Count > MaxRecentLogs)
                _recentLogs.RemoveAt(0);
        }

        await _hubContext.Clients.All.SendAsync("ReceiveLog", entry);
    }

    public IReadOnlyList<LogEntry> GetRecentLogs(string? scriptName = null)
    {
        lock (_lock)
        {
            if (scriptName is null)
                return _recentLogs.ToList();

            return _recentLogs.Where(l => l.ScriptName == scriptName).ToList();
        }
    }
}
