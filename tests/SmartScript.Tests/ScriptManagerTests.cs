using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;
using SmartScript.Executor;
using NSubstitute;
using Xunit;

namespace SmartScript.Tests;

public class ScriptManagerTests
{
    private readonly ScriptManager _manager = new();

    private static IScript CreateMockScript(string name)
    {
        var script = Substitute.For<IScript>();
        script.Metadata.Returns(new ScriptMetadata { Name = name });
        return script;
    }

    [Fact]
    public void Register_AddsScript_CanRetrieve()
    {
        var script = CreateMockScript("TestScript");

        _manager.Register(script);

        Assert.NotNull(_manager.GetScript("TestScript"));
        Assert.Single(_manager.GetAllScripts());
    }

    [Fact]
    public void Register_SetsInitialStateToIdle()
    {
        var script = CreateMockScript("TestScript");

        _manager.Register(script);

        Assert.Equal(ScriptState.Idle, _manager.GetState("TestScript"));
    }

    [Fact]
    public void Unregister_RemovesScript()
    {
        var script = CreateMockScript("TestScript");
        _manager.Register(script);

        _manager.Unregister("TestScript");

        Assert.Null(_manager.GetScript("TestScript"));
        Assert.Empty(_manager.GetAllScripts());
    }

    [Fact]
    public void GetScript_NonExistent_ReturnsNull()
    {
        Assert.Null(_manager.GetScript("DoesNotExist"));
    }

    [Fact]
    public void GetState_NonExistent_ReturnsIdle()
    {
        Assert.Equal(ScriptState.Idle, _manager.GetState("DoesNotExist"));
    }

    [Fact]
    public void SetState_UpdatesState()
    {
        var script = CreateMockScript("TestScript");
        _manager.Register(script);

        _manager.SetState("TestScript", ScriptState.Error);

        Assert.Equal(ScriptState.Error, _manager.GetState("TestScript"));
    }

    [Fact]
    public void StartTracking_SetsRunningState_ReturnsCts()
    {
        var script = CreateMockScript("TestScript");
        _manager.Register(script);

        var cts = _manager.StartTracking("TestScript");

        Assert.NotNull(cts);
        Assert.Equal(ScriptState.Running, _manager.GetState("TestScript"));
        Assert.False(cts.IsCancellationRequested);
    }

    [Fact]
    public void StopTracking_CancelsCts_SetsStoppedState()
    {
        var script = CreateMockScript("TestScript");
        _manager.Register(script);
        var cts = _manager.StartTracking("TestScript");

        _manager.StopTracking("TestScript");

        Assert.True(cts.IsCancellationRequested);
        Assert.Equal(ScriptState.Stopped, _manager.GetState("TestScript"));
    }

    [Fact]
    public void Register_MultipleScripts_AllRetrievable()
    {
        var script1 = CreateMockScript("Script1");
        var script2 = CreateMockScript("Script2");

        _manager.Register(script1);
        _manager.Register(script2);

        Assert.Equal(2, _manager.GetAllScripts().Count);
        Assert.NotNull(_manager.GetScript("Script1"));
        Assert.NotNull(_manager.GetScript("Script2"));
    }

    [Fact]
    public void Unregister_WithRunningToken_CancelsIt()
    {
        var script = CreateMockScript("TestScript");
        _manager.Register(script);
        var cts = _manager.StartTracking("TestScript");

        _manager.Unregister("TestScript");

        Assert.True(cts.IsCancellationRequested);
    }
}
