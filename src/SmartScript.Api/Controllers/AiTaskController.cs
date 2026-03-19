using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartScript.Api.Data;
using SmartScript.Api.Data.Entities;
using SmartScript.Api.Services;

namespace SmartScript.Api.Controllers;

[ApiController]
[Route("api/ai-tasks")]
public class AiTaskController(AppDbContext db, IAiTaskQueue queue) : ControllerBase
{
    // POST /api/ai-tasks
    [HttpPost]
    public async Task<IActionResult> Enqueue([FromBody] EnqueueAiTaskRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt is required.");

        var id = await queue.EnqueueAsync(
            request.Type        ?? "Generic",
            request.Description ?? request.Type ?? "AI Task",
            request.Prompt,
            request.Model       ?? "llama3.2",
            ct);

        return Accepted(new { id, status = AiTaskStatus.Pending });
    }

    // GET /api/ai-tasks
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? status,
        [FromQuery] string? type,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = db.AiTasks.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(t => t.Status == status);
        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(t => t.Type == type);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(t => t.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id, t.Type, t.Description, t.Model, t.Status,
                t.ErrorMessage, t.CreatedAt, t.StartedAt, t.CompletedAt,
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/ai-tasks/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var task = await db.AiTasks.FindAsync([id], ct);
        if (task is null) return NotFound();
        return Ok(task);
    }

    // DELETE /api/ai-tasks/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var task = await db.AiTasks.FindAsync([id], ct);
        if (task is null) return NotFound();
        db.AiTasks.Remove(task);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public class EnqueueAiTaskRequest
{
    public string? Type        { get; set; }
    public string? Description { get; set; }
    public string  Prompt      { get; set; } = string.Empty;
    public string? Model       { get; set; }
}
