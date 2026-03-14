using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SmartScript.Core.Services;
using SmartScript.WebUI.Services;

namespace SmartScript.WebUI.Controllers;

[ApiController]
[Route("api/spending-analysis")]
public class SpendingAnalysisController(SpendingAnalysisService analysisService, IOllamaClient ollamaClient) : ControllerBase
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

        var groupsJson = JsonSerializer.Serialize(
            request.Groups.Select(g => new { group = g.DisplayName, totalDebit = g.TotalDebit, count = g.Count }),
            new JsonSerializerOptions { WriteIndented = true });

        var prompt = $"""
            You are a personal finance analyst. Below is a list of spending groups from a bank statement.
            For each group, assign ONE category from: Food & Dining, Transport, Shopping, Bills & Utilities, Healthcare, Entertainment, Savings & Transfers, Other.
            Return ONLY a JSON array with no extra text: [{{"group":"<name>","category":"<cat>","confidence":"high|medium|low"}}]

            GROUPS:
            {groupsJson}
            """;

        string raw;
        try
        {
            raw = await ollamaClient.GenerateAsync(prompt, request.Model ?? "llama3.2", ct);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }

        // Try to extract JSON from the response (Ollama may include preamble text)
        var jsonStart = raw.IndexOf('[');
        var jsonEnd   = raw.LastIndexOf(']');
        if (jsonStart < 0 || jsonEnd < 0)
            return Ok(new { categories = Array.Empty<object>(), rawResponse = raw });

        var jsonSlice = raw[jsonStart..(jsonEnd + 1)];
        try
        {
            var categories = JsonSerializer.Deserialize<List<CategoryAssignment>>(jsonSlice,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return Ok(new { categories, rawResponse = raw });
        }
        catch
        {
            return Ok(new { categories = Array.Empty<object>(), rawResponse = raw });
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
}
