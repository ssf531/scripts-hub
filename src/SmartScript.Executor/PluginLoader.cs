using System.Reflection;
using System.Runtime.Loader;
using SmartScript.Core.Interfaces;

namespace SmartScript.Executor;

public class PluginLoader : IScriptLoader
{
    private readonly Dictionary<string, PluginContext> _loadedContexts = [];

    public string PluginDirectory { get; }

    public PluginLoader(string pluginDirectory)
    {
        PluginDirectory = pluginDirectory;
    }

    public IReadOnlyList<IScript> LoadScripts()
    {
        if (!Directory.Exists(PluginDirectory))
            return [];

        return LoadFromDirectory(PluginDirectory);
    }

    public IReadOnlyList<IScript> LoadFromDirectory(string pluginDirectory)
    {
        var scripts = new List<IScript>();

        if (!Directory.Exists(pluginDirectory))
            return scripts;

        foreach (var dllPath in Directory.GetFiles(pluginDirectory, "*.dll"))
        {
            try
            {
                var loaded = LoadPlugin(dllPath);
                scripts.AddRange(loaded);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(
                    $"Failed to load plugin from '{dllPath}': {ex.Message}. " +
                    "Verify the DLL targets the correct .NET version and implements IScript.");
            }
        }

        return scripts;
    }

    public void Unload(string scriptName)
    {
        if (_loadedContexts.Remove(scriptName, out var ctx))
        {
            ctx.Context.Unload();
        }
    }

    private List<IScript> LoadPlugin(string dllPath)
    {
        var context = new PluginAssemblyLoadContext(dllPath);
        var assembly = context.LoadFromAssemblyPath(Path.GetFullPath(dllPath));

        var scripts = new List<IScript>();
        var scriptTypes = assembly.GetTypes()
            .Where(t => typeof(IScript).IsAssignableFrom(t) && !t.IsAbstract && !t.IsInterface);

        foreach (var type in scriptTypes)
        {
            if (Activator.CreateInstance(type) is IScript script)
            {
                scripts.Add(script);
                _loadedContexts[script.Metadata.Name] = new PluginContext(context, dllPath);
            }
        }

        return scripts;
    }

    private sealed class PluginAssemblyLoadContext : AssemblyLoadContext
    {
        private readonly AssemblyDependencyResolver _resolver;

        public PluginAssemblyLoadContext(string pluginPath) : base(isCollectible: true)
        {
            _resolver = new AssemblyDependencyResolver(pluginPath);
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            var path = _resolver.ResolveAssemblyToPath(assemblyName);
            return path != null ? LoadFromAssemblyPath(path) : null;
        }
    }

    private record PluginContext(AssemblyLoadContext Context, string DllPath);
}
