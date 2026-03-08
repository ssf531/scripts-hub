# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY SmartScriptHub.sln .
COPY src/SmartScript.Core/SmartScript.Core.csproj src/SmartScript.Core/
COPY src/SmartScript.Executor/SmartScript.Executor.csproj src/SmartScript.Executor/
COPY src/SmartScript.WebUI/SmartScript.WebUI.csproj src/SmartScript.WebUI/
COPY src/SmartScript.Scripts.EmailCleaner/SmartScript.Scripts.EmailCleaner.csproj src/SmartScript.Scripts.EmailCleaner/
RUN dotnet restore

COPY . .
RUN dotnet publish src/SmartScript.WebUI/SmartScript.WebUI.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

RUN mkdir -p /app/config /app/downloads /app/plugins

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SmartScript.WebUI.dll"]
