using Google.Apis.Auth.OAuth2;
using Google.Apis.Gmail.v1;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;

namespace SmartScript.Scripts.EmailCleaner;

public class GmailClientWrapper : IDisposable
{
    private GmailService? _service;

    public void Initialize(UserCredential credential)
    {
        _service = new GmailService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "SmartScript Hub - Email Cleaner"
        });
    }

    public async Task<IList<Message>> FetchUnreadMessagesAsync(int maxResults = 20, CancellationToken ct = default)
    {
        EnsureInitialized();

        var request = _service!.Users.Messages.List("me");
        request.Q = "is:unread in:inbox";
        request.MaxResults = maxResults;

        var response = await request.ExecuteAsync(ct);
        if (response.Messages == null || response.Messages.Count == 0)
            return [];

        var messages = new List<Message>();
        foreach (var stub in response.Messages)
        {
            var full = await _service.Users.Messages.Get("me", stub.Id).ExecuteAsync(ct);
            messages.Add(full);
        }

        return messages;
    }

    public async Task TrashMessageAsync(string messageId, CancellationToken ct = default)
    {
        EnsureInitialized();
        await _service!.Users.Messages.Trash("me", messageId).ExecuteAsync(ct);
    }

    public async Task MarkAsReadAsync(string messageId, CancellationToken ct = default)
    {
        EnsureInitialized();

        var modRequest = new ModifyMessageRequest
        {
            RemoveLabelIds = ["UNREAD"]
        };
        await _service!.Users.Messages.Modify(modRequest, "me", messageId).ExecuteAsync(ct);
    }

    public void Dispose()
    {
        _service?.Dispose();
    }

    private void EnsureInitialized()
    {
        if (_service is null)
        {
            throw new InvalidOperationException(
                "GmailClientWrapper has not been initialized. " +
                "Call Initialize() with a valid UserCredential before making API calls.");
        }
    }
}
