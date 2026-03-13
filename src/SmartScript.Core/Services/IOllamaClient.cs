namespace SmartScript.Core.Services;

public interface IOllamaClient
{
    Task<string> GenerateAsync(string prompt, string model, CancellationToken ct);
    Task<List<string>> ListModelsAsync(CancellationToken ct);
}
