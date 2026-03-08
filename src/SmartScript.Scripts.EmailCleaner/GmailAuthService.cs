using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Gmail.v1;
using Google.Apis.Util.Store;

namespace SmartScript.Scripts.EmailCleaner;

public class GmailAuthService
{
    private const string TokenDirectory = "/app/config";
    private const string CredentialFileName = "credentials.json";

    private static readonly string[] Scopes =
    [
        GmailService.Scope.GmailModify,
        GmailService.Scope.GmailReadonly
    ];

    public async Task<UserCredential> AuthorizeAsync(CancellationToken ct)
    {
        var credentialPath = Path.Combine(TokenDirectory, CredentialFileName);

        if (!File.Exists(credentialPath))
        {
            throw new FileNotFoundException(
                $"Gmail credentials file not found at '{credentialPath}'. " +
                "Upload your Google OAuth credentials.json via the web UI to /app/config. " +
                "You can obtain this file from the Google Cloud Console under APIs & Services > Credentials.");
        }

        await using var stream = new FileStream(credentialPath, FileMode.Open, FileAccess.Read);

        var credential = await GoogleWebAuthorizationBroker.AuthorizeAsync(
            (await GoogleClientSecrets.FromStreamAsync(stream, ct)).Secrets,
            Scopes,
            "user",
            ct,
            new FileDataStore(TokenDirectory, true));

        if (credential.Token.IsStale)
        {
            var refreshed = await credential.RefreshTokenAsync(ct);
            if (!refreshed)
            {
                throw new InvalidOperationException(
                    "Failed to refresh expired Gmail OAuth token. " +
                    "Delete the token file in /app/config and re-authorize through the web UI.");
            }
        }

        return credential;
    }
}
