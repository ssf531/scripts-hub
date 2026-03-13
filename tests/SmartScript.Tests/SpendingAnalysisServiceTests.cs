using SmartScript.WebUI.Services;
using Xunit;

namespace SmartScript.Tests;

public class SpendingAnalysisServiceTests
{
    private readonly SpendingAnalysisService _service = new();

    // ── NormaliseDescription ──────────────────────────────────────────────────

    [Fact]
    public void NormaliseDescription_LowercasesAndTrims()
    {
        var result = SpendingAnalysisService.NormaliseDescription("  TESCO METRO  ");
        Assert.Equal("tesco metro", result);
    }

    [Fact]
    public void NormaliseDescription_RemovesTrailingStoreNumbers()
    {
        // "TESCO METRO 1234" → "tesco metro"
        var r1 = SpendingAnalysisService.NormaliseDescription("TESCO METRO 1234");
        var r2 = SpendingAnalysisService.NormaliseDescription("TESCO METRO 5678");
        Assert.Equal(r1, r2);
    }

    [Fact]
    public void NormaliseDescription_EmptyString_ReturnsUnknown()
    {
        Assert.Equal("(unknown)", SpendingAnalysisService.NormaliseDescription(""));
        Assert.Equal("(unknown)", SpendingAnalysisService.NormaliseDescription("   "));
    }

    // ── GroupTransactions ─────────────────────────────────────────────────────

    [Fact]
    public void GroupTransactions_TwoIdenticalDescriptions_ProducesOneGroup()
    {
        var rows = new List<CsvRow>
        {
            new("15/01/2024", "TESCO METRO", 10m, null, null, "test.csv"),
            new("16/01/2024", "TESCO METRO", 15m, null, null, "test.csv"),
        };

        var groups = _service.GroupTransactions(rows);

        Assert.Single(groups);
        Assert.Equal(2, groups[0].Count);
    }

    [Fact]
    public void GroupTransactions_SumsDebitsCorrectly()
    {
        var rows = new List<CsvRow>
        {
            new("15/01/2024", "COFFEE SHOP", 5m,  null, null, "test.csv"),
            new("16/01/2024", "COFFEE SHOP", 10m, null, null, "test.csv"),
            new("17/01/2024", "COFFEE SHOP", 15m, null, null, "test.csv"),
        };

        var groups = _service.GroupTransactions(rows);

        Assert.Single(groups);
        Assert.Equal(30m, groups[0].TotalDebit);
    }

    [Fact]
    public void GroupTransactions_NormalisesStoreNumbers_MergesRows()
    {
        var rows = new List<CsvRow>
        {
            new("15/01/2024", "TESCO METRO 1234", 10m, null, null, "a.csv"),
            new("16/01/2024", "TESCO METRO 5678", 20m, null, null, "a.csv"),
        };

        var groups = _service.GroupTransactions(rows);

        // Both should normalise to the same key → 1 group
        Assert.Single(groups);
        Assert.Equal(2, groups[0].Count);
        Assert.Equal(30m, groups[0].TotalDebit);
    }

    [Fact]
    public void GroupTransactions_FiltersByDateRange()
    {
        var rows = new List<CsvRow>
        {
            new("2024-01-10", "SHOP A", 10m, null, null, "test.csv"),
            new("2024-02-15", "SHOP A", 20m, null, null, "test.csv"),
            new("2024-03-20", "SHOP A", 30m, null, null, "test.csv"),
        };

        var from = new DateOnly(2024, 2, 1);
        var to   = new DateOnly(2024, 2, 28);
        var groups = _service.GroupTransactions(rows, from, to);

        Assert.Single(groups);
        Assert.Equal(1, groups[0].Count);
        Assert.Equal(20m, groups[0].TotalDebit);
    }

    [Fact]
    public void GroupTransactions_SortsByTotalDebitDescending()
    {
        var rows = new List<CsvRow>
        {
            new("2024-01-01", "CHEAP", 5m,  null, null, "test.csv"),
            new("2024-01-02", "CHEAP", 5m,  null, null, "test.csv"),
            new("2024-01-03", "EXPENSIVE", 200m, null, null, "test.csv"),
        };

        var groups = _service.GroupTransactions(rows);

        Assert.Equal(2, groups.Count);
        Assert.Equal(200m, groups[0].TotalDebit);   // EXPENSIVE first
    }

    // ── ParseCsv ─────────────────────────────────────────────────────────────

    [Fact]
    public void ParseCsv_ValidCsv_ReturnsRows()
    {
        var csv = """
            Date,Description,Debit,Credit,Balance,SourceFile
            15/01/2024,Coffee Shop,5.50,,1000.00,statement.pdf
            16/01/2024,Salary,,2000.00,3000.00,statement.pdf
            """;

        var rows = _service.ParseCsv(csv);

        Assert.Equal(2, rows.Count);
        Assert.Equal("15/01/2024", rows[0].Date);
        Assert.Equal("Coffee Shop", rows[0].Description);
        Assert.Equal(5.50m, rows[0].Debit);
        Assert.Null(rows[0].Credit);
        Assert.Equal(2000m, rows[1].Credit);
        Assert.Null(rows[1].Debit);
    }

    [Fact]
    public void ParseCsv_EmptyContent_ReturnsEmptyList()
    {
        Assert.Empty(_service.ParseCsv(""));
        Assert.Empty(_service.ParseCsv("Date,Description,Debit"));
    }

    // ── BuildExcel ────────────────────────────────────────────────────────────

    [Fact]
    public void BuildExcel_ReturnsByteArray_NonEmpty()
    {
        var rows = new List<CsvRow>
        {
            new("15/01/2024", "Coffee", 5m, null, null, "test.csv"),
        };
        var groups = new List<TransactionGroup>
        {
            new("coffee", "Coffee", 1, 5m, 0m, rows),
        };

        var bytes = _service.BuildExcel(rows, groups);

        Assert.NotEmpty(bytes);
        // XLSX files start with PK (zip header)
        Assert.Equal(0x50, bytes[0]);
        Assert.Equal(0x4B, bytes[1]);
    }

    [Fact]
    public void BuildExcel_EmptyInput_ReturnsByteArray()
    {
        var bytes = _service.BuildExcel([], []);
        Assert.NotEmpty(bytes);
    }
}
