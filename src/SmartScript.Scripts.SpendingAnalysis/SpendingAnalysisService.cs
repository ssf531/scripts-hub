using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace SmartScript.Scripts.SpendingAnalysis;

// ── Models ──────────────────────────────────────────────────────────────────

public record CsvRow(
    string Date,
    string Description,
    decimal? Debit,
    decimal? Credit,
    decimal? Balance,
    string SourceFile);

public record TransactionGroup(
    string NormalisedName,
    string DisplayName,
    int Count,
    decimal TotalDebit,
    decimal TotalCredit,
    List<CsvRow> Rows);

public record CategoryAssignment(
    string Group,
    string Category,
    string Confidence);

// ── Service ──────────────────────────────────────────────────────────────────

public partial class SpendingAnalysisService
{
    [GeneratedRegex(@"\s*\d+\s*$|\s+\d+\b")]
    private static partial Regex TrailingNumbersRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    // ── Parse CSV content ────────────────────────────────────────────────────

    public List<CsvRow> ParseCsv(string csvContent)
    {
        var rows = new List<CsvRow>();
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return rows;

        // Detect header positions
        var header = lines[0].Split(',');
        int dateIdx    = FindHeaderIndex(header, "date");
        int descIdx    = FindHeaderIndex(header, "description");
        int debitIdx   = FindHeaderIndex(header, "debit");
        int creditIdx  = FindHeaderIndex(header, "credit");
        int balanceIdx = FindHeaderIndex(header, "balance");
        int sourceIdx  = FindHeaderIndex(header, "sourcefile", "source");

        for (int i = 1; i < lines.Length; i++)
        {
            var parts = SplitCsvLine(lines[i]);
            if (parts.Length == 0) continue;

            rows.Add(new CsvRow(
                Date:        GetField(parts, dateIdx),
                Description: GetField(parts, descIdx),
                Debit:       ParseDecimal(GetField(parts, debitIdx)),
                Credit:      ParseDecimal(GetField(parts, creditIdx)),
                Balance:     ParseDecimal(GetField(parts, balanceIdx)),
                SourceFile:  GetField(parts, sourceIdx)
            ));
        }

        return rows;
    }

    // ── Group & filter ───────────────────────────────────────────────────────

    public List<TransactionGroup> GroupTransactions(
        List<CsvRow> rows,
        DateOnly? dateFrom = null,
        DateOnly? dateTo = null)
    {
        // Filter by date range if specified
        var filtered = rows;
        if (dateFrom.HasValue || dateTo.HasValue)
        {
            filtered = rows.Where(r =>
            {
                if (!DateOnly.TryParse(r.Date, out var d)) return true;
                if (dateFrom.HasValue && d < dateFrom.Value) return false;
                if (dateTo.HasValue && d > dateTo.Value) return false;
                return true;
            }).ToList();
        }

        // Group by normalised description
        var groups = filtered
            .GroupBy(r => NormaliseDescription(r.Description))
            .Select(g => new TransactionGroup(
                NormalisedName: g.Key,
                DisplayName:    g.Key,  // user can rename later
                Count:          g.Count(),
                TotalDebit:     g.Sum(r => r.Debit ?? 0m),
                TotalCredit:    g.Sum(r => r.Credit ?? 0m),
                Rows:           g.ToList()
            ))
            .OrderByDescending(g => g.TotalDebit)
            .ToList();

        return groups;
    }

    // ── Build Excel ──────────────────────────────────────────────────────────

    public byte[] BuildExcel(List<CsvRow> rows, List<TransactionGroup> groups)
    {
        using var workbook = new XLWorkbook();

        // Sheet 1: All Transactions
        var txSheet = workbook.Worksheets.Add("Transactions");
        var txHeaders = new[] { "Date", "Description", "Debit", "Credit", "Balance", "Source" };
        for (int c = 0; c < txHeaders.Length; c++)
        {
            var cell = txSheet.Cell(1, c + 1);
            cell.Value = txHeaders[c];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0d6efd");
            cell.Style.Font.FontColor = XLColor.White;
        }

        int txRow = 2;
        foreach (var row in rows)
        {
            txSheet.Cell(txRow, 1).Value = row.Date;
            txSheet.Cell(txRow, 2).Value = row.Description;
            txSheet.Cell(txRow, 3).Value = (double?)row.Debit ?? 0;
            txSheet.Cell(txRow, 4).Value = (double?)row.Credit ?? 0;
            txSheet.Cell(txRow, 5).Value = (double?)row.Balance ?? 0;
            txSheet.Cell(txRow, 6).Value = row.SourceFile;
            txRow++;
        }
        txSheet.Columns().AdjustToContents();

        // Sheet 2: Groups Summary
        decimal totalSpend = groups.Sum(g => g.TotalDebit);
        var sumSheet = workbook.Worksheets.Add("Groups Summary");
        var sumHeaders = new[] { "Group Name", "Count", "Total Debit", "Total Credit", "% of Total Spend" };
        for (int c = 0; c < sumHeaders.Length; c++)
        {
            var cell = sumSheet.Cell(1, c + 1);
            cell.Value = sumHeaders[c];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#198754");
            cell.Style.Font.FontColor = XLColor.White;
        }

        int sumRow = 2;
        foreach (var g in groups)
        {
            sumSheet.Cell(sumRow, 1).Value = g.DisplayName;
            sumSheet.Cell(sumRow, 2).Value = g.Count;
            sumSheet.Cell(sumRow, 3).Value = (double)g.TotalDebit;
            sumSheet.Cell(sumRow, 4).Value = (double)g.TotalCredit;
            double pct = totalSpend > 0 ? (double)(g.TotalDebit / totalSpend * 100) : 0;
            sumSheet.Cell(sumRow, 5).Value = Math.Round(pct, 2);
            sumRow++;
        }
        sumSheet.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    public static string NormaliseDescription(string description)
    {
        if (string.IsNullOrWhiteSpace(description)) return "(unknown)";

        var text = description.ToLowerInvariant().Trim();
        // Remove trailing store/branch numbers
        text = TrailingNumbersRegex().Replace(text, "");
        // Collapse whitespace
        text = WhitespaceRegex().Replace(text, " ").Trim();
        return text;
    }

    private static int FindHeaderIndex(string[] headers, params string[] names)
    {
        for (int i = 0; i < headers.Length; i++)
        {
            var h = headers[i].Trim().ToLowerInvariant().Trim('"');
            if (names.Any(n => h.Contains(n))) return i;
        }
        return -1;
    }

    private static string GetField(string[] parts, int idx)
        => idx >= 0 && idx < parts.Length ? parts[idx].Trim().Trim('"') : string.Empty;

    private static decimal? ParseDecimal(string value)
        => decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : null;

    private static string[] SplitCsvLine(string line)
    {
        // Handle quoted fields
        var result = new List<string>();
        bool inQuotes = false;
        var current = new StringBuilder();

        foreach (char ch in line)
        {
            if (ch == '"') { inQuotes = !inQuotes; }
            else if (ch == ',' && !inQuotes) { result.Add(current.ToString()); current.Clear(); }
            else { current.Append(ch); }
        }
        result.Add(current.ToString());
        return result.ToArray();
    }
}
