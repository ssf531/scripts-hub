using Microsoft.AspNetCore.SignalR;
using NSubstitute;
using SmartScript.Core.Models;
using SmartScript.Api.Hubs;
using SmartScript.Api.Services;
using Xunit;

namespace SmartScript.Tests;

public class LogBroadcastServiceTests
{
    private static LogBroadcastService CreateService()
    {
        var hubContext = Substitute.For<IHubContext<LogHub>>();
        var clients = Substitute.For<IHubClients>();
        var clientProxy = Substitute.For<IClientProxy>();
        hubContext.Clients.Returns(clients);
        clients.All.Returns(clientProxy);
        return new LogBroadcastService(hubContext);
    }

    [Fact]
    public async Task BroadcastAsync_AddsToRecentLogs()
    {
        var service = CreateService();
        var entry = new LogEntry { ScriptName = "Test", Message = "Hello" };

        await service.BroadcastAsync(entry);

        var logs = service.GetRecentLogs();
        Assert.Single(logs);
        Assert.Equal("Hello", logs[0].Message);
    }

    [Fact]
    public async Task GetRecentLogs_FiltersByScriptName()
    {
        var service = CreateService();
        await service.BroadcastAsync(new LogEntry { ScriptName = "Script1", Message = "A" });
        await service.BroadcastAsync(new LogEntry { ScriptName = "Script2", Message = "B" });
        await service.BroadcastAsync(new LogEntry { ScriptName = "Script1", Message = "C" });

        var logs = service.GetRecentLogs("Script1");

        Assert.Equal(2, logs.Count);
        Assert.All(logs, l => Assert.Equal("Script1", l.ScriptName));
    }

    [Fact]
    public async Task GetRecentLogs_NoFilter_ReturnsAll()
    {
        var service = CreateService();
        await service.BroadcastAsync(new LogEntry { ScriptName = "Script1", Message = "A" });
        await service.BroadcastAsync(new LogEntry { ScriptName = "Script2", Message = "B" });

        var logs = service.GetRecentLogs();

        Assert.Equal(2, logs.Count);
    }

    [Fact]
    public async Task BroadcastAsync_CapsAt500Entries()
    {
        var service = CreateService();

        for (int i = 0; i < 510; i++)
        {
            await service.BroadcastAsync(new LogEntry { ScriptName = "Test", Message = $"Log {i}" });
        }

        var logs = service.GetRecentLogs();
        Assert.Equal(500, logs.Count);
        // First entries should have been evicted
        Assert.Equal("Log 10", logs[0].Message);
    }

    [Fact]
    public async Task BroadcastAsync_SetsTimestamp()
    {
        var service = CreateService();
        var before = DateTime.UtcNow;

        await service.BroadcastAsync(new LogEntry { ScriptName = "Test", Message = "Timed" });

        var after = DateTime.UtcNow;
        var log = service.GetRecentLogs().Single();
        Assert.InRange(log.Timestamp, before, after);
    }

    [Fact]
    public async Task BroadcastAsync_DefaultsToInfoLevel()
    {
        var service = CreateService();

        await service.BroadcastAsync(new LogEntry { ScriptName = "Test", Message = "Info test" });

        var log = service.GetRecentLogs().Single();
        Assert.Equal(Core.Models.LogLevel.Info, log.Level);
    }
}
