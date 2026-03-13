# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Install Node.js for React frontend build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

COPY SmartScriptHub.slnx .
COPY src/SmartScript.Core/SmartScript.Core.csproj src/SmartScript.Core/
COPY src/SmartScript.Executor/SmartScript.Executor.csproj src/SmartScript.Executor/
COPY src/SmartScript.WebUI/SmartScript.WebUI.csproj src/SmartScript.WebUI/
COPY src/SmartScript.Scripts.EmailCleaner/SmartScript.Scripts.EmailCleaner.csproj src/SmartScript.Scripts.EmailCleaner/
COPY tests/SmartScript.Tests/SmartScript.Tests.csproj tests/SmartScript.Tests/
RUN dotnet restore SmartScriptHub.slnx

COPY . .
# PublishSpa target in csproj runs npm ci && npm run build automatically
RUN dotnet publish src/SmartScript.WebUI/SmartScript.WebUI.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

RUN mkdir -p /app/config /app/downloads /app/plugins

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SmartScript.WebUI.dll"]
