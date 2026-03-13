using Microsoft.AspNetCore.Mvc;
using SmartScript.WebUI.Services;

namespace SmartScript.WebUI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DiagnosticsController : ControllerBase
{
    private readonly TestConnectionService _testService;

    public DiagnosticsController(TestConnectionService testService)
    {
        _testService = testService;
    }

    [HttpPost("test-ollama")]
    public async Task<IActionResult> TestOllama(CancellationToken ct)
    {
        var result = await _testService.TestOllamaAsync(ct);
        return Ok(result);
    }

    [HttpPost("test-email")]
    public async Task<IActionResult> TestEmail([FromBody] TestEmailRequest? request)
    {
        var result = await _testService.TestEmailCredentialsAsync(request?.CredentialPath);
        return Ok(result);
    }
}

public class TestEmailRequest
{
    public string? CredentialPath { get; set; }
}
