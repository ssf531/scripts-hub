using System.Net.Http.Json;
using System.Text.Json;
using SmartScript.Core.Services;

namespace SmartScript.WebUI.Services;

public class OllamaClient : IOllamaClient
{
    private readonly HttpClient _httpClient;

    public OllamaClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> GenerateAsync(string prompt, string model, CancellationToken ct)
    {
        var request = new
        {
            model,
            prompt,
            stream = false
        };

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsJsonAsync("/api/generate", request, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException(
                $"Failed to connect to Ollama API at '{_httpClient.BaseAddress}'. " +
                "Ensure Ollama is running and accessible. " +
                $"HTTP error: {ex.Message}",
                ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"Ollama API returned status {(int)response.StatusCode} ({response.StatusCode}). " +
                $"Model: '{model}'. Response: {body}. " +
                "Verify the model is pulled (run 'ollama pull <model>') and the service is healthy.");
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
        return json.GetProperty("response").GetString() ?? string.Empty;
    }

    public async Task<List<string>> ListModelsAsync(CancellationToken ct)
    {
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.GetAsync("/api/tags", ct);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException(
                $"Failed to connect to Ollama API at '{_httpClient.BaseAddress}'. " +
                "Ensure Ollama is running and accessible. " +
                $"HTTP error: {ex.Message}",
                ex);
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"Ollama API returned status {(int)response.StatusCode} ({response.StatusCode}). " +
                $"Response: {body}.");
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
        var models = new List<string>();

        if (json.TryGetProperty("models", out var modelsArray))
        {
            foreach (var model in modelsArray.EnumerateArray())
            {
                if (model.TryGetProperty("name", out var name))
                {
                    models.Add(name.GetString() ?? string.Empty);
                }
            }
        }

        return models;
    }
}
