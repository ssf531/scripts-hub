using Google.Apis.Gmail.v1.Data;
using SmartScript.Scripts.EmailCleaner;
using Xunit;

namespace SmartScript.Tests;

public class EmailCleanerScriptTests
{
    [Theory]
    [InlineData("""{"score": 8, "summary": "Important meeting"}""", 8)]
    [InlineData("""{"score": 0, "summary": "Spam"}""", 0)]
    [InlineData("""{"score": 10, "summary": "Critical alert"}""", 10)]
    [InlineData("""{"score": 5, "summary": "Newsletter"}""", 5)]
    public void ParseImportanceScore_ValidJson_ReturnsCorrectScore(string input, int expected)
    {
        var result = EmailCleanerScript.ParseImportanceScore(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("no json here", 5)]
    [InlineData("", 5)]
    [InlineData("{}", 5)]
    [InlineData("""{"summary": "no score field"}""", 5)]
    public void ParseImportanceScore_InvalidInput_ReturnsDefault5(string input, int expected)
    {
        var result = EmailCleanerScript.ParseImportanceScore(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void ParseImportanceScore_ScoreAbove10_ClampedTo10()
    {
        var result = EmailCleanerScript.ParseImportanceScore("""{"score": 15, "summary": "test"}""");
        Assert.Equal(10, result);
    }

    [Fact]
    public void ParseImportanceScore_CaseInsensitive()
    {
        var result = EmailCleanerScript.ParseImportanceScore("""{"Score": 7, "Summary": "test"}""");
        Assert.Equal(7, result);
    }

    [Fact]
    public void BuildPrompt_ContainsEmailContent()
    {
        var content = "From: test@example.com\nSubject: Hello\n\nBody text";
        var prompt = EmailCleanerScript.BuildPrompt(content);

        Assert.Contains("test@example.com", prompt);
        Assert.Contains("Hello", prompt);
        Assert.Contains("Body text", prompt);
        Assert.Contains("score", prompt);
        Assert.Contains("summary", prompt);
        Assert.Contains("JSON", prompt);
    }

    [Fact]
    public void ExtractEmailContent_WithHeaders_ReturnsFormattedContent()
    {
        var message = new Message
        {
            Payload = new MessagePart
            {
                Headers =
                [
                    new MessagePartHeader { Name = "Subject", Value = "Test Subject" },
                    new MessagePartHeader { Name = "From", Value = "sender@example.com" }
                ],
                Body = new MessagePartBody
                {
                    Data = Convert.ToBase64String("Hello World"u8.ToArray())
                        .Replace('+', '-').Replace('/', '_')
                }
            }
        };

        var content = EmailCleanerScript.ExtractEmailContent(message);

        Assert.Contains("From: sender@example.com", content);
        Assert.Contains("Subject: Test Subject", content);
        Assert.Contains("Hello World", content);
    }

    [Fact]
    public void ExtractEmailContent_NoHeaders_UsesDefaults()
    {
        var message = new Message
        {
            Payload = new MessagePart()
        };

        var content = EmailCleanerScript.ExtractEmailContent(message);

        Assert.Contains("(no subject)", content);
        Assert.Contains("(unknown sender)", content);
    }

    [Fact]
    public void ExtractEmailContent_LongBody_TruncatesAt2000Chars()
    {
        var longBody = new string('A', 3000);
        var encoded = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(longBody))
            .Replace('+', '-').Replace('/', '_');

        var message = new Message
        {
            Payload = new MessagePart
            {
                Headers =
                [
                    new MessagePartHeader { Name = "Subject", Value = "Test" },
                    new MessagePartHeader { Name = "From", Value = "test@test.com" }
                ],
                Body = new MessagePartBody { Data = encoded }
            }
        };

        var content = EmailCleanerScript.ExtractEmailContent(message);

        Assert.Contains("...", content);
    }

    [Fact]
    public void ExtractBody_NullPart_ReturnsEmpty()
    {
        var result = EmailCleanerScript.ExtractBody(null);
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void ExtractBody_WithMultipart_PrefersPlainText()
    {
        var plainData = Convert.ToBase64String("Plain text"u8.ToArray())
            .Replace('+', '-').Replace('/', '_');
        var htmlData = Convert.ToBase64String("<b>HTML</b>"u8.ToArray())
            .Replace('+', '-').Replace('/', '_');

        var part = new MessagePart
        {
            Parts =
            [
                new MessagePart
                {
                    MimeType = "text/html",
                    Body = new MessagePartBody { Data = htmlData }
                },
                new MessagePart
                {
                    MimeType = "text/plain",
                    Body = new MessagePartBody { Data = plainData }
                }
            ]
        };

        var result = EmailCleanerScript.ExtractBody(part);
        Assert.Equal("Plain text", result);
    }
}
