using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using SmartScript.Core.Services;
using SmartScript.Scripts.PdfParser;
using SmartScript.Api.Controllers;
using SmartScript.Api.Services;
using Xunit;

namespace SmartScript.Tests;

public class PdfParserControllerTests
{
    private readonly IAiTaskQueue _queue = Substitute.For<IAiTaskQueue>();
    private readonly IOllamaClient _ollama = Substitute.For<IOllamaClient>();
    private readonly PdfParserService _parserService = new();

    private PdfParserController CreateController() => new(_parserService, _queue, _ollama);

    // ── Export endpoint ───────────────────────────────────────────────────────

    [Fact]
    public void Export_NoTransactions_ReturnsBadRequest()
    {
        var controller = CreateController();
        var request = new ExportRequest { Transactions = [] };

        var result = controller.Export(request);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void Export_WithTransactions_ReturnsCsvFile()
    {
        var controller = CreateController();
        var request = new ExportRequest
        {
            Transactions =
            [
                new("15/01/2024", "Coffee Shop", 5.50m, null, 1000m, "test.pdf"),
                new("16/01/2024", "Salary", null, 2000m, 3000m, "test.pdf"),
            ]
        };

        var result = controller.Export(request);

        var fileResult = Assert.IsType<FileContentResult>(result);
        Assert.Equal("text/csv", fileResult.ContentType);
        Assert.Equal("transactions.csv", fileResult.FileDownloadName);
    }

    [Fact]
    public void Export_CsvHeaders_AreCorrect()
    {
        var controller = CreateController();
        var request = new ExportRequest
        {
            Transactions = [new("15/01/2024", "Coffee", 5m, null, null, "test.pdf")]
        };

        var result = (FileContentResult)controller.Export(request);
        var csv = Encoding.UTF8.GetString(result.FileContents);
        var firstLine = csv.Split('\n')[0].Trim();

        Assert.Equal("Date,Description,Debit,Credit,Balance,SourceFile", firstLine);
    }

    [Fact]
    public void Export_RowCount_MatchesTransactionsPlusHeader()
    {
        var controller = CreateController();
        var transactions = new List<BankTransaction>
        {
            new("15/01/2024", "A", 5m, null, null, "t.pdf"),
            new("16/01/2024", "B", 10m, null, null, "t.pdf"),
            new("17/01/2024", "C", 15m, null, null, "t.pdf"),
        };
        var request = new ExportRequest { Transactions = transactions };

        var result = (FileContentResult)controller.Export(request);
        var csv = Encoding.UTF8.GetString(result.FileContents);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(4, lines.Length); // 1 header + 3 data rows
    }

    [Fact]
    public void Export_NullAmounts_AreEmptyFields()
    {
        var controller = CreateController();
        var request = new ExportRequest
        {
            Transactions = [new("15/01/2024", "Coffee", null, null, null, "test.pdf")]
        };

        var result = (FileContentResult)controller.Export(request);
        var csv = Encoding.UTF8.GetString(result.FileContents);
        var dataLine = csv.Split('\n')[1].Trim();

        // Debit, Credit, Balance should all be empty (not "null")
        var fields = dataLine.Split(',');
        Assert.Equal("", fields[2]);   // Debit
        Assert.Equal("", fields[3]);   // Credit
        Assert.Equal("", fields[4]);   // Balance
    }

    [Fact]
    public void Export_SelectedColumns_OnlyIncludesRequested()
    {
        var controller = CreateController();
        var request = new ExportRequest
        {
            Transactions = [new("15/01/2024", "Coffee", 5m, null, 100m, "test.pdf")],
            Columns = ["Date", "Description", "Debit"]
        };

        var result = (FileContentResult)controller.Export(request);
        var csv = Encoding.UTF8.GetString(result.FileContents);
        var header = csv.Split('\n')[0].Trim();

        Assert.Equal("Date,Description,Debit", header);
    }

    // ── Validate endpoint ─────────────────────────────────────────────────────

    [Fact]
    public async Task Validate_EnqueuesTask_ReturnsAccepted()
    {
        _queue.EnqueueAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
              .Returns(42);

        var controller = CreateController();
        var request = new ValidateRequest
        {
            Transactions = [new("15/01/2024", "Coffee", 5m, null, null, "t.pdf")],
            RawText = "15/01/2024 Coffee 5.00",
            Model = "llama3.2"
        };

        var result = await controller.Validate(request, CancellationToken.None);

        var accepted = Assert.IsType<AcceptedResult>(result);
        var json = JsonSerializer.Serialize(accepted.Value);
        Assert.Contains("42", json);
    }
}
