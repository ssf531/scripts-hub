using System.Collections.Concurrent;
using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;

namespace SmartScript.Executor;

public class ScriptManager
{
    private readonly ConcurrentDictionary<string, IScript> _scripts = new();
    private readonly ConcurrentDictionary<string, ScriptState> _states = new();
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _runningTokens = new();

    public void Register(IScript script)
    {
        _scripts[script.Metadata.Name] = script;
        _states.TryAdd(script.Metadata.Name, ScriptState.Idle);
    }

    public void Unregister(string scriptName)
    {
        _scripts.TryRemove(scriptName, out _);
        _states.TryRemove(scriptName, out _);
        if (_runningTokens.TryRemove(scriptName, out var cts))
            cts.Cancel();
    }

    public IScript? GetScript(string name) =>
        _scripts.GetValueOrDefault(name);

    public IReadOnlyList<IScript> GetAllScripts() =>
        _scripts.Values.ToList();

    public ScriptState GetState(string name) =>
        _states.GetValueOrDefault(name, ScriptState.Idle);

    public void SetState(string name, ScriptState state) =>
        _states[name] = state;

    public CancellationTokenSource StartTracking(string name)
    {
        var cts = new CancellationTokenSource();
        _runningTokens[name] = cts;
        _states[name] = ScriptState.Running;
        return cts;
    }

    public void StopTracking(string name)
    {
        if (_runningTokens.TryRemove(name, out var cts))
            cts.Cancel();
        _states[name] = ScriptState.Stopped;
    }
}
