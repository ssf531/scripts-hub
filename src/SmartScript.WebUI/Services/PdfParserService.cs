using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace SmartScript.WebUI.Services;

// ── Models ──────────────────────────────────────────────────────────────────

public record ColumnDef(string Name, double XMin, double XMax);

public record ColumnLayout(List<ColumnDef> Columns, double PageWidth);

public record BankTransaction(
    string Date,
    string Description,
    decimal? Debit,
    decimal? Credit,
    decimal? Balance,
    string SourceFile);

public record PreviewWord(string Text, string ColumnName, string Color);

public record PreviewRow(List<PreviewWord> Words);

public record ParsedFile(
    string Filename,
    List<BankTransaction> Transactions,
    string RawText,
    ColumnLayout Layout);

// ── Service ──────────────────────────────────────────────────────────────────

public class PdfParserService
{
    private static readonly string[] HeaderKeywords =
        ["DATE", "DESCRIPTION", "PARTICULARS", "DETAILS", "NARRATIVE",
         "DEBIT", "WITHDRAWALS", "WITHDRAWN",
         "CREDIT", "DEPOSITS", "DEPOSITED",
         "BALANCE", "AMOUNT"];

    private static readonly Dictionary<string, string> KeywordToColumn = new(StringComparer.OrdinalIgnoreCase)
    {
        ["DATE"]          = "Date",
        ["DESCRIPTION"]   = "Description",
        ["PARTICULARS"]   = "Description",
        ["DETAILS"]       = "Description",
        ["NARRATIVE"]     = "Description",
        ["DEBIT"]         = "Debit",
        ["WITHDRAWALS"]   = "Debit",
        ["WITHDRAWN"]     = "Debit",
        ["CREDIT"]        = "Credit",
        ["DEPOSITS"]      = "Credit",
        ["DEPOSITED"]     = "Credit",
        ["BALANCE"]       = "Balance",
        ["AMOUNT"]        = "Debit",  // generic — treat as debit
    };

    private static readonly Dictionary<string, string> ColumnColors = new()
    {
        ["Date"]        = "#0d6efd",
        ["Description"] = "#198754",
        ["Debit"]       = "#fd7e14",
        ["Credit"]      = "#0dcaf0",
        ["Balance"]     = "#6f42c1",
    };

    // Date patterns ordered from most-specific to least-specific
    private static readonly Regex[] DatePatterns =
    [
        new(@"^\d{4}-\d{2}-\d{2}$"),                        // yyyy-MM-dd
        new(@"^\d{1,2}/\d{1,2}/\d{4}$"),                    // dd/MM/yyyy or MM/dd/yyyy
        new(@"^\d{1,2}-\d{1,2}-\d{2,4}$"),                  // dd-MM-yy or dd-MM-yyyy
        new(@"^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$"),            // d MMM yyyy
        new(@"^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$"),          // MMM dd, yyyy
    ];

    private static readonly Regex AmountPattern = new(@"^-?[\d,]+(\.\d{1,2})?$");

    // ── Phase 1: Detect Layout ───────────────────────────────────────────────

    public ColumnLayout DetectLayout(Stream pdfStream)
    {
        using var doc = PdfDocument.Open(pdfStream);
        var firstPage = doc.GetPage(1);
        var words = firstPage.GetWords().ToList();
        double pageWidth = firstPage.Width;

        // Find header words — words whose text matches a known keyword
        var headerHits = new List<(string ColumnName, double XCenter)>();
        foreach (var word in words)
        {
            var text = word.Text.Trim().ToUpperInvariant();
            if (KeywordToColumn.TryGetValue(text, out var colName))
            {
                double xCenter = word.BoundingBox.Left + word.BoundingBox.Width / 2.0;
                headerHits.Add((colName, xCenter));
            }
        }

        if (headerHits.Count == 0)
            return new ColumnLayout([], pageWidth);

        // Deduplicate: if same column name appears multiple times, keep the first occurrence
        var seen = new HashSet<string>();
        var uniqueHits = headerHits
            .Where(h => seen.Add(h.ColumnName))
            .OrderBy(h => h.XCenter)
            .ToList();

        // Compute X-ranges: boundary = midpoint between adjacent column centers
        var columns = new List<ColumnDef>();
        for (int i = 0; i < uniqueHits.Count; i++)
        {
            var (colName, xCenter) = uniqueHits[i];
            double xMin = i == 0
                ? 0
                : (uniqueHits[i - 1].XCenter + xCenter) / 2.0;
            double xMax = i == uniqueHits.Count - 1
                ? pageWidth
                : (xCenter + uniqueHits[i + 1].XCenter) / 2.0;
            columns.Add(new ColumnDef(colName, xMin, xMax));
        }

        return new ColumnLayout(columns, pageWidth);
    }

    // ── Phase 1b: Preview Layout (first 5 data rows) ─────────────────────────

    public List<PreviewRow> PreviewLayout(Stream pdfStream, ColumnLayout layout)
    {
        using var doc = PdfDocument.Open(pdfStream);
        var result = new List<PreviewRow>();

        foreach (var page in doc.GetPages())
        {
            var lines = GroupWordsIntoLines(page.GetWords().ToList());
            foreach (var line in lines)
            {
                if (IsHeaderLine(line) || line.Count == 0) continue;

                var previewWords = line.Select(word =>
                {
                    double xCenter = word.BoundingBox.Left + word.BoundingBox.Width / 2.0;
                    var col = FindColumn(xCenter, layout);
                    var color = col != null && ColumnColors.TryGetValue(col.Name, out var c) ? c : "#6c757d";
                    return new PreviewWord(word.Text, col?.Name ?? "Unknown", color);
                }).ToList();

                result.Add(new PreviewRow(previewWords));
                if (result.Count >= 5) return result;
            }
        }
        return result;
    }

    // ── Phase 2: Parse All Pages ─────────────────────────────────────────────

    public ParsedFile Parse(Stream pdfStream, string filename, ColumnLayout layout)
    {
        using var doc = PdfDocument.Open(pdfStream);
        var transactions = new List<BankTransaction>();
        var rawTextBuilder = new StringBuilder();

        foreach (var page in doc.GetPages())
        {
            var words = page.GetWords().ToList();

            // Build raw text for Ollama validation
            var lines = GroupWordsIntoLines(words);
            foreach (var line in lines)
            {
                rawTextBuilder.AppendLine(string.Join(" ", line.Select(w => w.Text)));
            }

            // Parse transactions
            foreach (var line in lines)
            {
                if (IsHeaderLine(line) || line.Count == 0) continue;

                var tx = ParseLineToTransaction(line, layout, filename);
                if (tx != null) transactions.Add(tx);
            }
        }

        return new ParsedFile(filename, transactions, rawTextBuilder.ToString(), layout);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    public static List<List<Word>> GroupWordsIntoLines(List<Word> words, double yTolerance = 3.0)
    {
        if (words.Count == 0) return [];

        // Sort by Y descending (top-to-bottom in PDF coords), then X
        var sorted = words.OrderByDescending(w => w.BoundingBox.Bottom).ThenBy(w => w.BoundingBox.Left).ToList();

        var lines = new List<List<Word>>();
        var currentLine = new List<Word> { sorted[0] };
        double currentY = sorted[0].BoundingBox.Bottom;

        for (int i = 1; i < sorted.Count; i++)
        {
            double wordY = sorted[i].BoundingBox.Bottom;
            if (Math.Abs(wordY - currentY) <= yTolerance)
            {
                currentLine.Add(sorted[i]);
            }
            else
            {
                lines.Add(currentLine);
                currentLine = [sorted[i]];
                currentY = wordY;
            }
        }
        lines.Add(currentLine);

        return lines;
    }

    private bool IsHeaderLine(List<Word> line)
    {
        var lineText = string.Join(" ", line.Select(w => w.Text)).ToUpperInvariant();
        return HeaderKeywords.Any(kw => lineText.Contains(kw));
    }

    public BankTransaction? ParseLineToTransaction(List<Word> line, ColumnLayout layout, string sourceFile)
    {
        // Group words by column
        var buckets = new Dictionary<string, List<string>>();
        foreach (var col in layout.Columns)
            buckets[col.Name] = [];

        foreach (var word in line)
        {
            double xCenter = word.BoundingBox.Left + word.BoundingBox.Width / 2.0;
            var col = FindColumn(xCenter, layout);
            if (col != null && buckets.ContainsKey(col.Name))
                buckets[col.Name].Add(word.Text);
        }

        // Must have a date in the Date column
        if (!buckets.TryGetValue("Date", out var dateParts) || dateParts.Count == 0)
            return null;

        var dateStr = string.Join(" ", dateParts);
        if (!IsDate(dateStr)) return null;

        var description = buckets.TryGetValue("Description", out var descParts)
            ? string.Join(" ", descParts)
            : string.Empty;

        var debit   = ParseAmount(buckets, "Debit");
        var credit  = ParseAmount(buckets, "Credit");
        var balance = ParseAmount(buckets, "Balance");

        return new BankTransaction(dateStr, description, debit, credit, balance, sourceFile);
    }

    private static ColumnDef? FindColumn(double xCenter, ColumnLayout layout)
        => layout.Columns.FirstOrDefault(c => xCenter >= c.XMin && xCenter < c.XMax);

    public static bool IsDate(string text)
        => DatePatterns.Any(p => p.IsMatch(text.Trim()));

    private static decimal? ParseAmount(Dictionary<string, List<string>> buckets, string columnName)
    {
        if (!buckets.TryGetValue(columnName, out var parts) || parts.Count == 0)
            return null;

        var raw = string.Concat(parts).Replace(",", "");
        return decimal.TryParse(raw, out var value) ? value : null;
    }
}
