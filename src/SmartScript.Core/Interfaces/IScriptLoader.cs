namespace SmartScript.Core.Interfaces;

public interface IScriptLoader
{
    IReadOnlyList<IScript> LoadScripts();
    IReadOnlyList<IScript> LoadFromDirectory(string pluginDirectory);
    void Unload(string scriptName);
}
