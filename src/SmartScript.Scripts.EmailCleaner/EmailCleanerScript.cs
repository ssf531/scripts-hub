using System.Text;
using Google.Apis.Gmail.v1.Data;
using SmartScript.Core.Interfaces;
using SmartScript.Core.Models;
using SmartScript.Core.Services;

namespace SmartScript.Scripts.EmailCleaner;

public class EmailCleanerScript : IScript
{
    private readonly IOllamaClient _ollamaClient;
    private readonly GmailAuthService _authService;
    private CancellationTokenSource? _cts;

    public EmailCleanerScript(IOllamaClient ollamaClient)
    {
        _ollamaClient = ollamaClient;
        _authService = new GmailAuthService();
    }

    public ScriptMetadata Metadata { get; } = new()
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
                DefaultValue = "llama3.2"
            },
            new SettingDefinition
            {
                Key = "importanceThreshold",
                DisplayName = "Importance Threshold (0-10)",
                Type = SettingType.Slider,
                DefaultValue = "5",
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
            }
        ]
    };

    public async Task<ScriptResult> ExecuteAsync(IDictionary<string, object> settings, CancellationToken ct)
    {
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var token = _cts.Token;

        var model = GetSetting(settings, "ollamaModel", "llama3.2");
        var threshold = int.Parse(GetSetting(settings, "importanceThreshold", "5"));
        var maxEmails = int.Parse(GetSetting(settings, "maxEmails", "20"));
        var autoTrash = bool.Parse(GetSetting(settings, "autoTrash", "true"));

        using var gmail = new GmailClientWrapper();
        int processed = 0, trashed = 0, kept = 0;

        try
        {
            var credential = await _authService.AuthorizeAsync(token);
            gmail.Initialize(credential);

            var messages = await gmail.FetchUnreadMessagesAsync(maxEmails, token);
            if (messages.Count == 0)
            {
                return new ScriptResult
                {
                    Success = true,
                    Message = "No unread emails found in inbox."
                };
            }

            foreach (var message in messages)
            {
                token.ThrowIfCancellationRequested();

                var emailContent = ExtractEmailContent(message);
                var aiResponse = await _ollamaClient.GenerateAsync(
                    BuildPrompt(emailContent),
                    model,
                    token);

                var score = ParseImportanceScore(aiResponse);
                processed++;

                if (score < threshold && autoTrash)
                {
                    await gmail.TrashMessageAsync(message.Id, token);
                    trashed++;
                }
                else
                {
                    kept++;
                }
            }

            return new ScriptResult
            {
                Success = true,
                Message = $"Processed {processed} emails: {kept} kept, {trashed} trashed.",
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
            return new ScriptResult
            {
                Success = false,
                Message = $"Email cleaning was cancelled. Processed {processed} of {maxEmails} emails before stopping."
            };
        }
        catch (Exception ex)
        {
            return new ScriptResult
            {
                Success = false,
                Message = $"Email cleaning failed: {ex.Message}. " +
                          "Check that Gmail credentials are valid and Ollama is running. " +
                          $"Processed {processed} emails before failure.",
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

    private static string ExtractEmailContent(Message message)
    {
        var headers = message.Payload?.Headers ?? [];
        var subject = headers.FirstOrDefault(h => h.Name == "Subject")?.Value ?? "(no subject)";
        var from = headers.FirstOrDefault(h => h.Name == "From")?.Value ?? "(unknown sender)";

        var body = ExtractBody(message.Payload);
        if (body.Length > 2000)
            body = body[..2000] + "...";

        return $"From: {from}\nSubject: {subject}\n\n{body}";
    }

    private static string ExtractBody(MessagePart? part)
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

    private static string BuildPrompt(string emailContent)
    {
        return $"""
            Analyze the following email and respond with ONLY a JSON object containing:
            - "score": an importance score from 0 to 10 (10 = critical, 0 = spam)
            - "summary": a one-sentence summary of the email

            Email:
            {emailContent}

            Response (JSON only):
            """;
    }

    private static int ParseImportanceScore(string aiResponse)
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

    private static string GetSetting(IDictionary<string, object> settings, string key, string defaultValue)
    {
        return settings.TryGetValue(key, out var value) ? value.ToString() ?? defaultValue : defaultValue;
    }
}
