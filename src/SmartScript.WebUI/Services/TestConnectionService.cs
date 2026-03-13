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

    public async Task<M3u8DLTestResult> TestM3u8DLAsync(string executablePath = "N_m3u8DL-RE", CancellationToken ct = default)
    {
        var resolved = ResolveExecutable(executablePath);
        if (resolved is null)
        {
            return new M3u8DLTestResult
            {
                Success = false,
                Message = $"Executable not found: '{executablePath}'. Install N_m3u8DL-RE and ensure it is in PATH, or set an absolute path in script settings.",
                ResolvedPath = null
            };
        }

        // Run --version to confirm it works
        try
        {
            using var process = new System.Diagnostics.Process
            {
                StartInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = resolved,
                    Arguments = "--version",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };

            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync(ct);
            var err = await process.StandardError.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);

            var version = (output + err).Split('\n').FirstOrDefault(l => l.Trim().Length > 0)?.Trim() ?? "unknown";

            return new M3u8DLTestResult
            {
                Success = true,
                Message = $"Found: {version}",
                ResolvedPath = resolved
            };
        }
        catch (Exception ex)
        {
            return new M3u8DLTestResult
            {
                Success = false,
                Message = $"Found at '{resolved}' but failed to run: {ex.Message}",
                ResolvedPath = resolved
            };
        }
    }

    private static string? ResolveExecutable(string executablePath)
    {
        if (Path.IsPathRooted(executablePath) || executablePath.Contains(Path.DirectorySeparatorChar) || executablePath.Contains('/'))
            return File.Exists(executablePath) ? executablePath : null;

        var localPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, executablePath);
        if (File.Exists(localPath)) return localPath;
        var localExe = localPath + ".exe";
        if (File.Exists(localExe)) return localExe;

        var pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in pathEnv.Split(Path.PathSeparator))
        {
            try
            {
                var candidate = Path.Combine(dir, executablePath);
                if (File.Exists(candidate)) return candidate;
                var candidateExe = candidate + ".exe";
                if (File.Exists(candidateExe)) return candidateExe;
            }
            catch { }
        }

        return null;
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

public class M3u8DLTestResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public string? ResolvedPath { get; init; }
}

public class EmailTestResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = string.Empty;
    public bool CredentialFileFound { get; init; }
    public bool TokenFileFound { get; init; }
}
