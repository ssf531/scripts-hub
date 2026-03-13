using Microsoft.AspNetCore.Mvc;

namespace SmartScript.WebUI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _config;

    public ConfigController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            OllamaUrl = _config["OLLAMA_BASE_URL"]
                ?? _config["Ollama:BaseUrl"]
                ?? "http://localhost:11434",
            DefaultModel = _config["Ollama:DefaultModel"] ?? "llama3.2",
            CredentialPath = _config["CredentialPath"] ?? "/app/config",
            PluginDirectory = _config["PluginDirectory"] ?? "/app/plugins"
        });
    }
}
