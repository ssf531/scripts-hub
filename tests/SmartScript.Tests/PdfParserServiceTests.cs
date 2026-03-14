using SmartScript.WebUI.Services;
using Xunit;

namespace SmartScript.Tests;

public class PdfParserServiceTests
{
    // ── IsDate ────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("15/01/2024")]      // dd/MM/yyyy
    [InlineData("01/15/2024")]      // MM/dd/yyyy
    [InlineData("2024-01-15")]      // yyyy-MM-dd
    [InlineData("15-01-24")]        // dd-MM-yy
    [InlineData("15 Jan 2024")]     // d MMM yyyy
    [InlineData("Jan 15, 2024")]    // MMM dd, yyyy
    [InlineData("1 Feb 2024")]      // single-digit day
    public void IsDate_ValidDateStrings_ReturnsTrue(string input)
    {
        Assert.True(PdfParserService.IsDate(input));
    }

    [Theory]
    [InlineData("hello")]
    [InlineData("")]
    [InlineData("123.45")]
    [InlineData("COFFEE SHOP")]
    [InlineData("  ")]
    public void IsDate_NonDateStrings_ReturnsFalse(string input)
    {
        Assert.False(PdfParserService.IsDate(input));
    }

    // ── GroupWordsIntoLines ───────────────────────────────────────────────────

    [Fact]
    public void GroupWordsIntoLines_EmptyInput_ReturnsEmpty()
    {
        var result = PdfParserService.GroupWordsIntoLines([]);
        Assert.Empty(result);
    }

    // ── ParseLineToTransaction ────────────────────────────────────────────────

    [Fact]
    public void ParseLineToTransaction_NullOrEmptyDateBucket_ReturnsNull()
    {
        var service = new PdfParserService();
        var layout = new ColumnLayout(
        [
            new ColumnDef("Date", 0, 80),
            new ColumnDef("Description", 80, 300),
            new ColumnDef("Debit", 300, 400),
        ], 400);

        // Empty line → no date → should return null
        var result = service.ParseLineToTransaction([], layout, "test.pdf");
        Assert.Null(result);
    }
}
