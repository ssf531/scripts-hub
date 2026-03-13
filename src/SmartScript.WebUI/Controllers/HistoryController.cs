using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartScript.WebUI.Data;

namespace SmartScript.WebUI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HistoryController : ControllerBase
{
    private readonly AppDbContext _db;

    public HistoryController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent([FromQuery] int count = 50)
    {
        if (count is < 1 or > 500)
        {
            count = 50;
        }

        var records = await _db.ScriptRunRecords
            .OrderByDescending(r => r.StartedAt)
            .Take(count)
            .Select(r => new
            {
                r.Id,
                r.ScriptName,
                r.StartedAt,
                r.CompletedAt,
                r.Success,
                r.ResultMessage
            })
            .ToListAsync();

        return Ok(records);
    }
}

