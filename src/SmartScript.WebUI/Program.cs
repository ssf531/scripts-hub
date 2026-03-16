using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Quartz;
using SmartScript.Core.Interfaces;
using SmartScript.Core.Services;
using SmartScript.Executor;
using SmartScript.Executor.Scheduling;
using SmartScript.Scripts.EmailCleaner;
using SmartScript.Scripts.M3u8Downloader;
using SmartScript.WebUI.Data;
using SmartScript.WebUI.Hubs;
using SmartScript.WebUI.Services;

var builder = WebApplication.CreateBuilder(args);

// API Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=smartscript.db";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

// Ollama HTTP client
var ollamaUrl = builder.Configuration["OLLAMA_BASE_URL"]
    ?? builder.Configuration["Ollama:BaseUrl"]
    ?? "http://localhost:11434";
builder.Services.AddHttpClient<IOllamaClient, OllamaClient>(client =>
{
    client.BaseAddress = new Uri(ollamaUrl);
    client.Timeout = TimeSpan.FromMinutes(10);
});

// PDF parser & spending analysis
builder.Services.AddScoped<PdfParserService>();
builder.Services.AddScoped<SpendingAnalysisService>();

// Core services
builder.Services.AddSingleton<LogBroadcastService>();
builder.Services.AddSingleton<IScriptLogger, ScriptLogger>();
builder.Services.AddScoped<ScriptHubService>();
builder.Services.AddScoped<TestConnectionService>();
builder.Services.AddSingleton<ScriptManager>();

// Built-in scripts
builder.Services.AddTransient<IScript, EmailCleanerScript>();
builder.Services.AddTransient<IScript, M3u8DownloaderScript>();

// AI task queue (singleton + hosted service)
builder.Services.AddSingleton<AiTaskQueueService>();
builder.Services.AddSingleton<IAiTaskQueue>(sp => sp.GetRequiredService<AiTaskQueueService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<AiTaskQueueService>());

// Plugin loader & executor
var pluginDir = builder.Configuration["PluginDirectory"] ?? "/app/plugins";
builder.Services.AddSingleton<IScriptLoader>(sp => new PluginLoader(pluginDir));
builder.Services.AddHostedService<ScriptExecutorService>();

// Quartz.NET
builder.Services.AddQuartz();
builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);
builder.Services.AddScoped<QuartzSchedulerService>();

var app = builder.Build();

// Auto-migrate database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
    app.UseHttpsRedirection();
}

// Serve React static files from wwwroot (ClientApp/dist copied here)
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();
app.MapHub<LogHub>("/hubs/log");

// SPA fallback: any unmatched route serves index.html for client-side routing
app.MapFallbackToFile("index.html");

app.Run();
