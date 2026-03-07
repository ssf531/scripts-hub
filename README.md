# SmartScript Hub: Modular AI-Powered Automation Center

**SmartScript Hub** is a lightweight, self-hosted automation management platform built with **.NET 9** and **Blazor Server**. It is designed to automate repetitive digital tasks using local AI (Ollama) and various API integrations through a modular, plugin-based architecture.

---

## 1. Project Vision

The goal is to provide a "plug-and-play" automation hub where users can discover, configure, and execute scripts via a clean web interface. By utilizing Docker, the platform ensures that privacy-sensitive data—such as emails and local files—is processed locally without ever leaving your infrastructure.

---

## 2. System Architecture

The project is divided into several decoupled components to ensure maximum extensibility:

- **SmartScript.Core**: The foundation library defining script contracts (`IScript`), configuration metadata (`ScriptMetadata`), and file handling standards.

- **SmartScript.WebUI (Blazor)**: A browser-based interface for managing script states, real-time monitoring, and dynamic configuration.

- **SmartScript.Executor**: A background service that manages script lifecycles and triggers tasks based on schedules or specific events.

- **SmartScript.Scripts.EmailCleaner**: The flagship plugin implementing Gmail integration and AI-driven mail sorting.

  ***

## 3. Core Functionality: AI Email Sorter

The first built-in automation script follows this intelligent workflow:

1.  **OAuth2 Authentication**: Users upload their `credentials.json` via the web UI and complete the Gmail authorization flow in their browser.

2.  **Smart Fetching**: The script periodically retrieves unread emails from the inbox.

3.  **Local AI Summarization**: Email content is sent to a local **Ollama** model for summary generation and importance scoring (0–10).

4.  **Automated Decision-Making**:

- **High-Value Emails**: Remain unread; summaries are highlighted in the dashboard.

- **Low-Value/Spam**: Automatically moved to the trash or deleted to keep the inbox clean.

  ***

## 4. Docker Deployment & Local File Synchronization

The platform leverages **Docker Bind Mounts** to allow scripts to interact directly with your host machine's file system.

### Directory Mapping

| Container Path | Host Path (Example) | Purpose                                                    |
| -------------- | ------------------- | ---------------------------------------------------------- |
| `/app/config`  | `./config`          | Stores OAuth tokens, SQLite database, and script settings. |

|
| `/app/downloads` | `D:/Downloads/Auto` | <br>**All files downloaded by scripts appear here instantly**.

|

### Example `docker-compose.yml`

```yaml
services:
  smart-script-hub:
    image: smart-script-hub:latest
    container_name: smart-script-hub
    ports:
      - "5000:8080"
    volumes:
      - ./config:/app/config
      - D:/Downloads/Auto:/app/downloads
    extra_hosts:
      - "host.docker.internal:host-gateway" # Access host Ollama service
    environment:
      - [cite_start]OLLAMA_BASE_URL=http://host.docker.internal:11434 [cite: 91, 92]

```

---

## 5. UI Design

- **Script Dashboard**: Card-based view of all scripts with "Start/Stop" controls and success rate metrics.

- **Dynamic Settings**: An adaptive form engine that automatically renders UI inputs (text, sliders, toggles) based on the script's metadata.

- **Real-time Logs**: Integrated **SignalR** console for viewing AI processing steps and script logs live.

  ***

## 6. Important Considerations & Precautions

> [!IMPORTANT]
> **Privacy & Security**
>
> - **Local-First**: All LLM processing is performed by Ollama. No email content is sent to third-party AI providers.
> - **Credential Safety**: Sensitive tokens are stored in the `/app/config` volume. Ensure this directory is backed up and restricted.

> [!CAUTION]
> **Performance & Connectivity**
>
> - **Resource Impact**: Running large LLMs via Ollama can be CPU/GPU intensive. Monitor host resources if running multiple scripts simultaneously.
> - **Network Bridge**: When running in Docker, you must use `host.docker.internal` (Windows/Mac) or the appropriate gateway IP to reach the Ollama API on the host.
> - **Gmail Quotas**: Frequent polling may hit Google API rate limits. It is recommended to set reasonable intervals (e.g., every 15–30 minutes).

---

## 7. Development Roadmap

- **Phase 1**: Core interface definitions, Docker multi-stage build setup, and Gmail OAuth integration.

- **Phase 2**: Blazor Dashboard development and the dynamic form engine.

- **Phase 3**: Quartz.NET task scheduling and hot-loading support for `.dll` plugins.

  ***
