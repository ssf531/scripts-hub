using System.Net;
using System.Text;
using SmartScript.WebUI.Services;
using Xunit;

namespace SmartScript.Tests;

public class OllamaClientTests
{
    private static OllamaClient CreateClient(HttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("http://localhost:11434")
        };
        return new OllamaClient(httpClient);
    }

    [Fact]
    public async Task GenerateAsync_SuccessResponse_ReturnsContent()
    {
        var handler = new MockHttpHandler(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"response": "Hello from AI"}""", Encoding.UTF8, "application/json")
        });

        var client = CreateClient(handler);
        var result = await client.GenerateAsync("test prompt", "llama3.2", CancellationToken.None);

        Assert.Equal("Hello from AI", result);
    }

    [Fact]
    public async Task GenerateAsync_ServerError_ThrowsWithDetails()
    {
        var handler = new MockHttpHandler(new HttpResponseMessage(HttpStatusCode.InternalServerError)
        {
            Content = new StringContent("model not found", Encoding.UTF8, "text/plain")
        });

        var client = CreateClient(handler);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => client.GenerateAsync("test", "bad-model", CancellationToken.None));

        Assert.Contains("500", ex.Message);
        Assert.Contains("bad-model", ex.Message);
    }

    [Fact]
    public async Task GenerateAsync_ConnectionFailure_ThrowsWithHelpfulMessage()
    {
        var handler = new MockHttpHandler(new HttpRequestException("Connection refused"));

        var client = CreateClient(handler);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => client.GenerateAsync("test", "model", CancellationToken.None));

        Assert.Contains("Failed to connect", ex.Message);
        Assert.Contains("Ollama", ex.Message);
    }

    [Fact]
    public async Task ListModelsAsync_SuccessResponse_ReturnsModelNames()
    {
        var handler = new MockHttpHandler(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """{"models": [{"name": "llama3.2"}, {"name": "mistral"}]}""",
                Encoding.UTF8, "application/json")
        });

        var client = CreateClient(handler);
        var models = await client.ListModelsAsync(CancellationToken.None);

        Assert.Equal(2, models.Count);
        Assert.Contains("llama3.2", models);
        Assert.Contains("mistral", models);
    }

    [Fact]
    public async Task ListModelsAsync_EmptyModels_ReturnsEmptyList()
    {
        var handler = new MockHttpHandler(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"models": []}""", Encoding.UTF8, "application/json")
        });

        var client = CreateClient(handler);
        var models = await client.ListModelsAsync(CancellationToken.None);

        Assert.Empty(models);
    }

    [Fact]
    public async Task ListModelsAsync_ConnectionFailure_ThrowsWithHelpfulMessage()
    {
        var handler = new MockHttpHandler(new HttpRequestException("Connection refused"));

        var client = CreateClient(handler);
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => client.ListModelsAsync(CancellationToken.None));

        Assert.Contains("Failed to connect", ex.Message);
    }

    private class MockHttpHandler : HttpMessageHandler
    {
        private readonly HttpResponseMessage? _response;
        private readonly Exception? _exception;

        public MockHttpHandler(HttpResponseMessage response) => _response = response;
        public MockHttpHandler(Exception exception) => _exception = exception;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (_exception is not null) throw _exception;
            return Task.FromResult(_response!);
        }
    }
}
