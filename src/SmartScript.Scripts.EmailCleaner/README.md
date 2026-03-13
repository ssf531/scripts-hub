# SmartScript.Scripts.EmailCleaner

Built-in plugin that implements the AI Email Sorter workflow: fetch unread Gmail messages, summarize them with a local Ollama model, score importance, and auto-trash low-value emails.

## Contents

```
SmartScript.Scripts.EmailCleaner/
├── EmailCleanerScript.cs    # IScript implementation (main orchestration)
├── GmailAuthService.cs      # OAuth2 authorization flow
└── GmailClientWrapper.cs    # Gmail API wrapper
```

## Dependencies

| Package              | Version     | Purpose                      |
| -------------------- | ----------- | ---------------------------- |
| Google.Apis.Gmail.v1 | 1.73.0.4029 | Gmail API client             |
| Google.Apis.Auth     | 1.73.0      | Google OAuth2 authentication |

**Project reference**: SmartScript.Core

## Workflow

```
1. OAuth2 Authorize  -->  Load credentials.json, get/refresh token
2. Fetch Unread      -->  Gmail API: list unread inbox messages
3. AI Summarize      -->  Send each email to Ollama for scoring (0-10)
4. Decision          -->  Score >= threshold: keep  |  Score < threshold: trash
5. Report            -->  Return ScriptResult with processed/kept/trashed counts
```

## Configurable Settings

These settings are defined in `EmailCleanerScript.Metadata.Settings` and rendered as a dynamic form in the WebUI:

| Key                   | Display Name                | Type   | Default       | Range |
| --------------------- | --------------------------- | ------ | ------------- | ----- |
| `ollamaModel`         | Ollama Model                | Text   | `llama3.2`    | --    |
| `importanceThreshold` | Importance Threshold (0-10) | Slider | `5`           | 0-10  |
| `maxEmails`           | Max Emails Per Run          | Number | `20`          | 1-100 |
| `autoTrash`           | Auto-Trash Low-Value Emails | Toggle | `true`        | --    |
| `credentialPath`      | Gmail Credential Path       | Text   | `/app/config` | --    |

## Scheduling

Default cron expression: `0 */15 * * * ?` (every 15 minutes).

This is defined in `ScriptMetadata.CronExpression` and automatically registered with Quartz.NET by the Executor on startup. The schedule can be adjusted by modifying the cron expression in the source.

## Gmail OAuth Setup

1. Create a Google Cloud project with Gmail API enabled.
2. Create an OAuth 2.0 Client ID (Desktop application type) in the Credentials section.
3. Download `credentials.json` and place it in `/app/config/` (Docker) or the working directory (local dev). The path is configurable via the `credentialPath` setting.
4. On first execution, a browser window opens for Gmail authorization. The token is saved to the same config directory and auto-refreshed on subsequent runs.

### File Locations

| File                             | Path           | Purpose                |
| -------------------------------- | -------------- | ---------------------- |
| `credentials.json`               | `/app/config/` | Google OAuth client ID |
| `Google.Apis.Auth.*` token files | `/app/config/` | Persisted OAuth tokens |

## AI Prompt

The script sends each email to Ollama with a prompt requesting a JSON response containing:

- `score` -- Importance score from 0 (spam) to 10 (critical)
- `summary` -- One-sentence summary

The response is parsed to extract the score. If parsing fails, a default score of 5 is used (keep the email).

## Error Handling

- **Missing credentials**: Throws `FileNotFoundException` with instructions to upload `credentials.json`.
- **Expired token**: Attempts automatic refresh; throws with re-authorization instructions on failure.
- **Gmail not initialized**: Guard method throws `InvalidOperationException` before API calls.
- **Cancellation**: Returns partial results with count of emails processed before stopping.
- **General failure**: Returns `ScriptResult` with error type, message, and partial progress count.
