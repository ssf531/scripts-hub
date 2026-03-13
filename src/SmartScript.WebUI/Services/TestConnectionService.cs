using SmartScript.Core.Services;

namespace SmartScript.WebUI.Services;

public class TestConnectionService
{
    private readonly IOllamaClient _ollamaClient;

    public TestConnectionService(IOllamaClient ollamaClient)
    {
        _ollamaClient = ollamaClient;
    }

    public async Task<OllamaTestResult> TestOllamaAsync(CancellationToken ct = default)
    {
        try
        {
            var models = await _ollamaClient.ListModelsAsync(ct);
            return new OllamaTestResult
            {
                Success = true,
                Message = $"Connected. {models.Count} model(s) available.",
                AvailableModels = models
            };
        }
        catch (Exception ex)
        {
            return new OllamaTestResult
            {
                Success = false,
                Message = $"Connection failed: {ex.Message}"
            };
        }
    }

    public Task<EmailTestResult> TestEmailCredentialsAsync(string? credentialDirectory = null)
    {
        var tokenDir = credentialDirectory ?? "/app/config";
        var credentialPath = Path.Combine(tokenDir, "credentials.json");
        var tokenPath = Path.Combine(tokenDir, "Google.Apis.Auth.OAuth2.Responses.TokenResponse-user");

        var credentialExists = File.Exists(credentialPath);
        var tokenExists = File.Exists(tokenPath);

        if (!credentialExists)
        {
            return Task.FromResult(new EmailTestResult
            {
                Success = false,
                Message = $"credentials.json not found at '{credentialPath}'. Download it from Google Cloud Console > APIs & Services > Credentials (create an OAuth 2.0 Client ID with Desktop application type).",
                CredentialFileFound = false,
                TokenFileFound = tokenExists
            });
        }

        return Task.FromResult(new EmailTestResult
        {
            Success = true,
            Message = tokenExists
                ? "Credentials found. OAuth token exists (previously authorized)."
                : "Credentials found but no OAuth token yet. Run the Email Cleaner script once — a Google consent screen will open in your browser. Approve access to generate the token.",
            CredentialFileFound = true,
            TokenFileFound = tokenExists
        });
    }
}

public class OllamaTestResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public List<string> AvailableModels { get; init; } = [];
}

public class EmailTestResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public bool CredentialFileFound { get; init; }
    public bool TokenFileFound { get; init; }
}
