using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SmartScript.Core.Services;
using SmartScript.Scripts.SpendingAnalysis;
using SmartScript.Api.Services;

namespace SmartScript.Api.Controllers;

[ApiController]
[Route("api/spending-analysis")]
public class SpendingAnalysisController(SpendingAnalysisService analysisService, IOllamaClient ollamaClient, IAiTaskQueue aiTaskQueue) : ControllerBase
{
    // POST /api/spending-analysis/group
    // Accepts CSV files and returns grouped transaction summary.
    [HttpPost("group")]
    public async Task<IActionResult> Group(
        [FromForm] List<IFormFile> files,
        [FromForm] string? dateFrom,
        [FromForm] string? dateTo)
    {
        if (files == null || files.Count == 0)
            return BadRequest("No CSV files uploaded.");

        DateOnly? from = DateOnly.TryParse(dateFrom, out var df) ? df : null;
        DateOnly? to   = DateOnly.TryParse(dateTo, out var dt) ? dt : null;

        var allRows = new List<CsvRow>();
        foreach (var file in files)
        {
            using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8);
            var content = await reader.ReadToEndAsync();
            var rows = analysisService.ParseCsv(content);
            allRows.AddRange(rows);
        }

        var groups = analysisService.GroupTransactions(allRows, from, to);
        return Ok(new { rows = allRows, groups });
    }

    // POST /api/spending-analysis/export-excel
    // Returns a .xlsx file with two sheets: Transactions and Groups Summary.
    [HttpPost("export-excel")]
    public IActionResult ExportExcel([FromBody] ExcelExportRequest request)
    {
        if (request.Rows == null || request.Rows.Count == 0)
            return BadRequest("No rows to export.");

        var bytes = analysisService.BuildExcel(request.Rows, request.Groups ?? []);

        var dateTag = DateTime.Now.ToString("yyyy-MM");
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"spending_{dateTag}.xlsx");
    }

    // POST /api/spending-analysis/categorise
    // Uses Ollama to assign spending categories to each transaction group.
    [HttpPost("categorise")]
    public async Task<IActionResult> Categorise([FromBody] CategoriseRequest request, CancellationToken ct)
    {
        if (request.Groups == null || request.Groups.Count == 0)
            return BadRequest("No groups to categorise.");

        string raw;
        try
        {
            raw = await ollamaClient.GenerateAsync(BuildPrompt(request), request.Model ?? "llama3.2", ct);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }

        return Ok(ParseCategoriesResponse(raw));
    }

    // POST /api/spending-analysis/categorise-queue
    // Enqueue categorisation task instead of blocking.
    [HttpPost("categorise-queue")]
    public async Task<IActionResult> CategoriseQueue([FromBody] CategoriseRequest request, CancellationToken ct)
    {
        if (request.Groups == null || request.Groups.Count == 0)
            return BadRequest("No groups to categorise.");

        var taskId = await aiTaskQueue.EnqueueAsync(
            type:        "SpendingCategorisation",
            description: $"Categorise {request.Groups.Count} spending group(s)",
            prompt:      BuildPrompt(request),
            model:       request.Model ?? "llama3.2",
            ct:          ct);

        return Accepted(new { taskId });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static readonly string[] DefaultCategories =
        ["Food & Dining", "Transport", "Shopping", "Bills & Utilities", "Healthcare", "Entertainment", "Savings & Transfers", "Other"];

    private static string BuildPrompt(CategoriseRequest request)
    {
        var cats     = request.Categories is { Count: > 0 } ? request.Categories : [..DefaultCategories];
        var catList  = string.Join(", ", cats);
        var groupsJson = JsonSerializer.Serialize(
            request.Groups.Select(g => new { group = g.DisplayName, totalDebit = g.TotalDebit, count = g.Count }),
            new JsonSerializerOptions { WriteIndented = true });

        var notesSection = request.MerchantNotes is { Count: > 0 }
            ? $"\nMERCHANT NOTES (use these to improve categorisation accuracy):\n" +
              string.Join("\n", request.MerchantNotes.Select(n => $"- {n}")) + "\n"
            : "";

        return $"""
            You are a personal finance analyst. Below is a list of spending groups from a bank statement.
            For each group, assign ONE category from: {catList}.
            Return ONLY a JSON array with no extra text: [{{"group":"<name>","category":"<cat>","confidence":"high|medium|low"}}]
            {notesSection}
            GROUPS:
            {groupsJson}
            """;
    }

    private static object ParseCategoriesResponse(string raw)
    {
        var jsonStart = raw.IndexOf('[');
        var jsonEnd   = raw.LastIndexOf(']');
        if (jsonStart < 0 || jsonEnd < 0)
            return new { categories = Array.Empty<object>(), rawResponse = raw };

        try
        {
            var categories = JsonSerializer.Deserialize<List<CategoryAssignment>>(
                raw[jsonStart..(jsonEnd + 1)],
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return new { categories, rawResponse = raw };
        }
        catch
        {
            return new { categories = Array.Empty<object>(), rawResponse = raw };
        }
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public class ExcelExportRequest
{
    public List<CsvRow> Rows { get; set; } = [];
    public List<TransactionGroup>? Groups { get; set; }
}

public class CategoriseRequest
{
    public List<TransactionGroup> Groups { get; set; } = [];
    public string? Model { get; set; }
    /// <summary>Custom category names. Falls back to the default 8 if empty.</summary>
    public List<string>? Categories { get; set; }
    /// <summary>Free-text merchant hints injected into the AI prompt, e.g. "PB Tech is an online electronics store".</summary>
    public List<string>? MerchantNotes { get; set; }
}
