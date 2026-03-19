using Microsoft.AspNetCore.Mvc;
using SmartScript.Api.Services;

namespace SmartScript.Api.Controllers;

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

    [HttpPost("test-m3u8dl")]
    public async Task<IActionResult> TestM3u8DL([FromBody] TestM3u8DLRequest? request, CancellationToken ct)
    {
        var result = await _testService.TestM3u8DLAsync(request?.ExecutablePath ?? "N_m3u8DL-RE", ct);
        return Ok(result);
    }
}

public class TestEmailRequest
{
    public string? CredentialPath { get; set; }
}

public class TestM3u8DLRequest
{
    public string? ExecutablePath { get; set; }
}
