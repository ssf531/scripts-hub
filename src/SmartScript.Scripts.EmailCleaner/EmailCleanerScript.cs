using System.Text;
using Google.Apis.Gmail.v1.Data;
using Microsoft.Extensions.Configuration;
using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;
using SmartScript.Core.Services;

namespace SmartScript.Scripts.EmailCleaner;

public class EmailCleanerScript : IScript
{
    private readonly IOllamaClient _ollamaClient;
    private readonly IScriptLogger _logger;
    private readonly GmailAuthService _authService;
    private CancellationTokenSource? _cts;

    public EmailCleanerScript(IOllamaClient ollamaClient, IScriptLogger logger, IConfiguration configuration)
    {
        _ollamaClient = ollamaClient;
        _logger = logger;
        _authService = new GmailAuthService();

        var defaultModel = configuration["Ollama:DefaultModel"] ?? "llama3.2";
        var defaultCredentialPath = configuration["CredentialPath"] ?? "/app/config";
        var defaultImportanceThreshold = configuration["EmailCleaner:DefaultThreshold"] ?? "5";
        var defaultAdsThreshold = configuration["EmailCleaner:AdsThreshold"] ?? "8";

        Metadata = new ScriptMetadata
        {
            Name = "AI Email Cleaner",
            Description = "Fetches unread Gmail messages, summarizes them using local AI (Ollama), and automatically sorts high-value emails from spam.",
            Version = "1.0.0",
            Author = "SmartScript Hub",
            Icon = "bi-envelope-open",
            CronExpression = "0 */15 * * * ?", // Every 15 minutes
            Settings =
            [
                new SettingDefinition
                {
                    Key = "ollamaModel",
                    DisplayName = "Ollama Model",
                    Type = SettingType.Text,
                    DefaultValue = defaultModel
                },
                new SettingDefinition
                {
                    Key = "importanceThreshold",
                    DisplayName = "Importance Threshold (0-10)",
                    Type = SettingType.Slider,
                    DefaultValue = defaultImportanceThreshold,
                    Min = 0,
                    Max = 10
                },
                new SettingDefinition
                {
                    Key = "adsThreshold",
                    DisplayName = "Ads Threshold (0-10)",
                    Type = SettingType.Slider,
                    DefaultValue = defaultAdsThreshold,
                    Min = 0,
                    Max = 10
                },
                new SettingDefinition
                {
                    Key = "maxEmails",
                    DisplayName = "Max Emails Per Run",
                    Type = SettingType.Number,
                    DefaultValue = "20",
                    Min = 1,
                    Max = 100
                },
                new SettingDefinition
                {
                    Key = "autoTrash",
                    DisplayName = "Auto-Trash Low-Value Emails",
                    Type = SettingType.Toggle,
                    DefaultValue = "true"
                },
                new SettingDefinition
                {
                    Key = "credentialPath",
                    DisplayName = "Gmail Credential Path",
                    Type = SettingType.Text,
                    DefaultValue = defaultCredentialPath
                }
            ]
        };
    }

    public ScriptMetadata Metadata { get; }

    public async Task<ScriptResult> ExecuteAsync(IDictionary<string, object> settings, CancellationToken ct)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var token = _cts.Token;

        var model = GetSetting(settings, "ollamaModel", "llama3.2");
        var threshold = int.Parse(GetSetting(settings, "importanceThreshold", "5"));
        var adsThreshold = int.Parse(GetSetting(settings, "adsThreshold", "8"));
        var maxEmails = int.Parse(GetSetting(settings, "maxEmails", "20"));
        var autoTrash = bool.Parse(GetSetting(settings, "autoTrash", "true"));
        var credentialPath = GetSetting(settings, "credentialPath", "/app/config");

        await Log($"Settings loaded: model={model}, threshold={threshold}, maxEmails={maxEmails}, autoTrash={autoTrash}");

        using var gmail = new GmailClientWrapper();
        int processed = 0, trashed = 0, kept = 0;

        try
        {
            await Log("Authenticating with Gmail...");
            var credential = await _authService.AuthorizeAsync(token, credentialPath);
            gmail.Initialize(credential);
            await Log("Gmail authentication successful.");

            await Log($"Fetching up to {maxEmails} unread emails...");
            var messages = await gmail.FetchUnreadMessagesAsync(maxEmails, token);
            if (messages.Count == 0)
            {
                await Log("No unread emails found in inbox.");
                return new ScriptResult
                {
                    Success = true,
                    Message = "No unread emails found in inbox."
                };
            }

            await Log($"Found {messages.Count} unread email(s). Processing with AI model '{model}'...");

            foreach (var message in messages)
            {
                token.ThrowIfCancellationRequested();

                var emailContent = ExtractEmailContent(message);
                var subject = message.Payload?.Headers?.FirstOrDefault(h => h.Name == "Subject")?.Value ?? "(no subject)";

                await Log($"[{processed + 1}/{messages.Count}] Analyzing: {subject}");

                var aiResponse = await _ollamaClient.GenerateAsync(
                    BuildPrompt(emailContent),
                    model,
                    token);

                var (score, category) = ParseClassification(aiResponse);
                processed++;

                // Determine effective threshold based on category (e.g., ads can have a higher threshold)
                var effectiveThreshold = threshold;
                if (category.Equals("ads", StringComparison.OrdinalIgnoreCase))
                {
                    effectiveThreshold = adsThreshold;
                }

                if (score < effectiveThreshold && autoTrash)
                {
                    await gmail.TrashMessageAsync(message.Id, token);
                    trashed++;
                    await Log($"  Category: {category}, score: {score}/10 - TRASHED (below threshold {effectiveThreshold})");
                }
                else
                {
                    kept++;
                    await Log($"  Category: {category}, score: {score}/10 - KEPT (threshold {effectiveThreshold})");
                }
            }

            var resultMsg = $"Processed {processed} emails: {kept} kept, {trashed} trashed.";
            await Log(resultMsg);

            return new ScriptResult
            {
                Success = true,
                Message = resultMsg,
                Details = new Dictionary<string, object>
                {
                    ["processed"] = processed,
                    ["kept"] = kept,
                    ["trashed"] = trashed
                }
            };
        }
        catch (OperationCanceledException)
        {
            var msg = $"Email cleaning was cancelled. Processed {processed} of {maxEmails} emails before stopping.";
            await LogSafe(msg, LogLevel.Warning);
            return new ScriptResult
            {
                Success = false,
                Message = msg
            };
        }
        catch (Exception ex)
        {
            var msg = $"Email cleaning failed: {ex.Message}. " +
                      "Check that Gmail credentials are valid and Ollama is running. " +
                      $"Processed {processed} emails before failure.";
            await LogSafe(msg, LogLevel.Error);
            return new ScriptResult
            {
                Success = false,
                Message = msg,
                Details = new Dictionary<string, object>
                {
                    ["errorType"] = ex.GetType().Name,
                    ["processed"] = processed
                }
            };
        }
    }

    public Task StopAsync()
    {
        _cts?.Cancel();
        return Task.CompletedTask;
    }

    internal static string ExtractEmailContent(Message message)
    {
        var headers = message.Payload?.Headers ?? [];
        var subject = headers.FirstOrDefault(h => h.Name == "Subject")?.Value ?? "(no subject)";
        var from = headers.FirstOrDefault(h => h.Name == "From")?.Value ?? "(unknown sender)";

        var body = ExtractBody(message.Payload);
        if (body.Length > 2000)
            body = body[..2000] + "...";

        return $"From: {from}\nSubject: {subject}\n\n{body}";
    }

    internal static string ExtractBody(MessagePart? part)
    {
        if (part == null) return string.Empty;

        if (part.Body?.Data != null)
        {
            var data = part.Body.Data
                .Replace('-', '+')
                .Replace('_', '/');
            return Encoding.UTF8.GetString(Convert.FromBase64String(data));
        }

        if (part.Parts != null)
        {
            var textPart = part.Parts.FirstOrDefault(p => p.MimeType == "text/plain")
                           ?? part.Parts.FirstOrDefault(p => p.MimeType == "text/html");
            return textPart != null ? ExtractBody(textPart) : string.Empty;
        }

        return string.Empty;
    }

    internal static string BuildPrompt(string emailContent)
    {
        return $"""
            Analyze the following email and respond with ONLY a JSON object containing:
            - "score": an importance score from 0 to 10 (10 = critical, 0 = spam)
            - "summary": a one-sentence summary of the email
            - "category": a short category label such as "ads" or "general"

            Email:
            {emailContent}

            Response (JSON only, no explanation text):
            """;
    }

    internal static int ParseImportanceScore(string aiResponse)
    {
        try
        {
            var scoreIndex = aiResponse.IndexOf("\"score\"", StringComparison.OrdinalIgnoreCase);
            if (scoreIndex < 0) return 5;

            var colonIndex = aiResponse.IndexOf(':', scoreIndex);
            if (colonIndex < 0) return 5;

            var remaining = aiResponse[(colonIndex + 1)..].Trim();
            var numStr = new string(remaining.TakeWhile(c => char.IsDigit(c)).ToArray());
            return int.TryParse(numStr, out var score) ? Math.Clamp(score, 0, 10) : 5;
        }
        catch
        {
            return 5;
        }
    }

    internal static (int Score, string Category) ParseClassification(string aiResponse)
    {
        var score = ParseImportanceScore(aiResponse);
        var category = "general";

        try
        {
            var catIndex = aiResponse.IndexOf("\"category\"", StringComparison.OrdinalIgnoreCase);
            if (catIndex >= 0)
            {
                var colonIndex = aiResponse.IndexOf(':', catIndex);
                if (colonIndex >= 0)
                {
                    var remaining = aiResponse[(colonIndex + 1)..].Trim();

                    if (remaining.StartsWith("\"", StringComparison.Ordinal))
                    {
                        // Category as string value: "ads"
                        remaining = remaining[1..];
                        var endQuote = remaining.IndexOf('"');
                        if (endQuote >= 0)
                        {
                            var raw = remaining[..endQuote].Trim();
                            if (!string.IsNullOrWhiteSpace(raw))
                                category = raw;
                        }
                    }
                    else
                    {
                        // Fallback: read continuous letters as category
                        var raw = new string(remaining.TakeWhile(char.IsLetter).ToArray());
                        if (!string.IsNullOrWhiteSpace(raw))
                            category = raw;
                    }
                }
            }
        }
        catch
        {
            // ignore and fall back to default category
        }

        return (score, category);
    }

    private static string GetSetting(IDictionary<string, object> settings, string key, string defaultValue)
    {
        return settings.TryGetValue(key, out var value) ? value.ToString() ?? defaultValue : defaultValue;
    }

    private Task Log(string message, LogLevel level = LogLevel.Info)
    {
        return _logger.LogAsync(Metadata.Name, message, level);
    }

    private async Task LogSafe(string message, LogLevel level = LogLevel.Info)
    {
        try { await _logger.LogAsync(Metadata.Name, message, level); }
        catch { /* swallow logging errors during shutdown */ }
    }
}
