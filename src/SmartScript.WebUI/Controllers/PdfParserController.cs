using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SmartScript.WebUI.Services;

namespace SmartScript.WebUI.Controllers;

[ApiController]
[Route("api/pdf-parser")]
public class PdfParserController(PdfParserService parserService, IAiTaskQueue aiTaskQueue) : ControllerBase
{
    // POST /api/pdf-parser/detect-layout
    // Analyses the first uploaded PDF and returns detected column layout.
    [HttpPost("detect-layout")]
    public IActionResult DetectLayout(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        using var stream = file.OpenReadStream();
        var layout = parserService.DetectLayout(stream);
        return Ok(layout);
    }

    // POST /api/pdf-parser/preview-layout
    // Returns first 5 data rows with words tagged by detected column (for user confirmation).
    [HttpPost("preview-layout")]
    public async Task<IActionResult> PreviewLayout([FromForm] IFormFile file, [FromForm] string layout)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        ColumnLayout? columnLayout;
        try
        {
            columnLayout = JsonSerializer.Deserialize<ColumnLayout>(layout,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return BadRequest("Invalid layout JSON.");
        }

        if (columnLayout == null)
            return BadRequest("Layout could not be parsed.");

        using var stream = file.OpenReadStream();
        var preview = parserService.PreviewLayout(stream, columnLayout);
        return Ok(preview);
    }

    // POST /api/pdf-parser/parse
    // Parses all uploaded PDFs using the given layout and returns merged transactions.
    [HttpPost("parse")]
    public async Task<IActionResult> Parse([FromForm] List<IFormFile> files, [FromForm] string layout)
    {
        if (files == null || files.Count == 0)
            return BadRequest("No files uploaded.");

        ColumnLayout? columnLayout;
        try
        {
            columnLayout = JsonSerializer.Deserialize<ColumnLayout>(layout,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            return BadRequest("Invalid layout JSON.");
        }

        if (columnLayout == null)
            return BadRequest("Layout could not be parsed.");

        var results = new List<ParsedFile>();
        foreach (var file in files)
        {
            using var stream = file.OpenReadStream();
            var parsed = parserService.Parse(stream, file.FileName, columnLayout);
            results.Add(parsed);
        }

        return Ok(results);
    }

    // POST /api/pdf-parser/validate
    // Enqueues an Ollama validation task and returns the task ID immediately (202 Accepted).
    [HttpPost("validate")]
    public async Task<IActionResult> Validate([FromBody] ValidateRequest request, CancellationToken ct)
    {
        var rawTextExcerpt = request.RawText.Length > 3000
            ? request.RawText[..3000]
            : request.RawText;

        var transactionsJson = JsonSerializer.Serialize(request.Transactions,
            new JsonSerializerOptions { WriteIndented = true });

        var prompt = $"""
            You are a bank statement auditor. Raw PDF text and parsed transactions are below.
            Verify each parsed transaction accurately matches the source. Report discrepancies concisely.

            RAW TEXT (excerpt):
            {rawTextExcerpt}

            PARSED TRANSACTIONS (JSON):
            {transactionsJson}
            """;

        var taskId = await aiTaskQueue.EnqueueAsync(
            type:        "PdfValidation",
            description: $"Validate {request.Transactions.Count} transaction(s)",
            prompt:      prompt,
            model:       request.Model ?? "llama3.2",
            ct:          ct);

        return Accepted(new { taskId });
    }

    // POST /api/pdf-parser/export
    // Returns a CSV file containing all provided transactions.
    [HttpPost("export")]
    public IActionResult Export([FromBody] ExportRequest request)
    {
        if (request.Transactions == null || request.Transactions.Count == 0)
            return BadRequest("No transactions to export.");

        var csv = BuildCsv(request.Transactions, request.Columns);
        var bytes = Encoding.UTF8.GetBytes(csv);
        return File(bytes, "text/csv", "transactions.csv");
    }

    private static string BuildCsv(List<BankTransaction> transactions, List<string>? columns)
    {
        var allColumns = new[] { "Date", "Description", "Debit", "Credit", "Balance", "SourceFile" };
        var selectedColumns = columns?.Count > 0
            ? allColumns.Where(c => columns.Contains(c, StringComparer.OrdinalIgnoreCase)).ToArray()
            : allColumns;

        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", selectedColumns));

        foreach (var tx in transactions)
        {
            var fields = selectedColumns.Select<string, string>(col => col switch
            {
                "Date"        => CsvEscape(tx.Date),
                "Description" => CsvEscape(tx.Description),
                "Debit"       => tx.Debit?.ToString("F2") ?? "",
                "Credit"      => tx.Credit?.ToString("F2") ?? "",
                "Balance"     => tx.Balance?.ToString("F2") ?? "",
                "SourceFile"  => CsvEscape(tx.SourceFile),
                _             => ""
            });
            sb.AppendLine(string.Join(",", fields));
        }

        return sb.ToString();
    }

    private static string CsvEscape(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public class ValidateRequest
{
    public List<BankTransaction> Transactions { get; set; } = [];
    public string RawText { get; set; } = string.Empty;
    public string? Model { get; set; }
}

public class ExportRequest
{
    public List<BankTransaction> Transactions { get; set; } = [];
    public List<string>? Columns { get; set; }
}
