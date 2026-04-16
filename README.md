# Upstash MCP Server

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=upstash&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB1cHN0YXNoL21jcC1zZXJ2ZXJAbGF0ZXN0IiwiLS1lbWFpbCIsIllPVVJfRU1BSUwiLCItLWFwaS1rZXkiLCJZT1VSX0FQSV9LRVkiXX0%3D)
[<img alt="Install in VS Code" src="https://img.shields.io/badge/Install%20in%20VS%20Code-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white">](https://insiders.vscode.dev/redirect/mcp/install?name=upstash&inputs=%5B%7B%22id%22%3A%22email%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Upstash%20email%22%7D%2C%7B%22id%22%3A%22apiKey%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Upstash%20API%20key%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Fmcp-server%40latest%22%2C%22--email%22%2C%22%24%7Binput%3Aemail%7D%22%2C%22--api-key%22%2C%22%24%7Binput%3AapiKey%7D%22%5D%7D)

The Upstash MCP server lets your agent manage and debug your Upstash resources directly, across **Redis**, **QStash**, **Workflow**, and **[Upstash Box](https://upstash.com/docs/box/overall/quickstart)**.

> [!TIP]
> For most workflows, prefer installing the [Upstash Skill](https://upstash.com/docs/agent-resources/skills) and letting your agent drive [`@upstash/cli`](https://upstash.com/docs/agent-resources/cli) over running the MCP server.

## Quickstart

You'll need your Upstash account email and an API key — create one at [Upstash Console → Account → API Keys](https://console.upstash.com/account/api).

The Upstash MCP server works with any MCP-compatible client. If your client isn't listed below, check its documentation for how to add a stdio MCP server, then point it at the base command:

```bash
npx -y @upstash/mcp-server@latest --email YOUR_EMAIL --api-key YOUR_API_KEY
```

> [!NOTE]
> Readonly API keys are supported. When the server starts with one, it automatically disables every tool that would modify state (creating databases, deleting backups, retrying workflows, etc.). Your agent can still read and query your account, but it cannot make changes.

<details>
<summary><b>Claude Code</b></summary>

Run this command in your terminal. See the [Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/mcp) for more info.

```sh
claude mcp add --scope user upstash -- npx -y @upstash/mcp-server@latest --email YOUR_EMAIL --api-key YOUR_API_KEY
```

</details>

<details>
<summary><b>Cursor</b></summary>

Go to `Settings` → `Cursor Settings` → `MCP` → `Add new global MCP server`.

Pasting the following configuration into your Cursor `~/.cursor/mcp.json` file is the recommended approach. You may also install in a specific project by creating `.cursor/mcp.json` in your project folder. See the [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol) for more info.

Since Cursor 1.0, you can click the install button below for instant one-click installation. Replace `YOUR_EMAIL` and `YOUR_API_KEY` with your real values before confirming.

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=upstash&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB1cHN0YXNoL21jcC1zZXJ2ZXJAbGF0ZXN0IiwiLS1lbWFpbCIsIllPVVJfRU1BSUwiLCItLWFwaS1rZXkiLCJZT1VSX0FQSV9LRVkiXX0%3D)

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

Add this to your Windsurf MCP config file at `~/.codeium/windsurf/mcp_config.json`. See the [Windsurf MCP docs](https://docs.windsurf.com/windsurf/cascade/mcp) for more info.

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>OpenCode</b></summary>

Add this to your OpenCode configuration file (`~/.config/opencode/opencode.json` or a project-level `opencode.json`). See the [OpenCode MCP docs](https://opencode.ai/docs/mcp-servers) for more info.

```json
{
  "mcp": {
    "upstash": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ],
      "enabled": true
    }
  }
}
```

</details>

<details>
<summary><b>OpenAI Codex</b></summary>

See the [OpenAI Codex MCP docs](https://developers.openai.com/codex/mcp) for more info.

**Using the CLI**

```sh
codex mcp add upstash -- npx -y @upstash/mcp-server@latest --email YOUR_EMAIL --api-key YOUR_API_KEY
```

**Manual configuration**

Add this to your Codex config file (`~/.codex/config.toml` or `.codex/config.toml`):

```toml
[mcp_servers.upstash]
command = "npx"
args = ["-y", "@upstash/mcp-server@latest", "--email", "YOUR_EMAIL", "--api-key", "YOUR_API_KEY"]
startup_timeout_sec = 20
```

> [!NOTE]
> If you see startup timeout errors, increase `startup_timeout_sec` to `40`.

</details>

<details>
<summary><b>VS Code</b></summary>

Click to install — VS Code will prompt for your email and API key (stored in its secret storage):

[<img alt="Install in VS Code" src="https://img.shields.io/badge/Install%20in%20VS%20Code-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white" />](https://insiders.vscode.dev/redirect/mcp/install?name=upstash&inputs=%5B%7B%22id%22%3A%22email%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Upstash%20email%22%7D%2C%7B%22id%22%3A%22apiKey%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Upstash%20API%20key%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Fmcp-server%40latest%22%2C%22--email%22%2C%22%24%7Binput%3Aemail%7D%22%2C%22--api-key%22%2C%22%24%7Binput%3AapiKey%7D%22%5D%7D)
[<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/Install%20in%20VS%20Code%20Insiders-24bfa5?style=for-the-badge&logo=visualstudiocode&logoColor=white" />](https://insiders.vscode.dev/redirect/mcp/install?name=upstash&inputs=%5B%7B%22id%22%3A%22email%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Upstash%20email%22%7D%2C%7B%22id%22%3A%22apiKey%22%2C%22type%22%3A%22promptString%22%2C%22description%22%3A%22Upstash%20API%20key%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Fmcp-server%40latest%22%2C%22--email%22%2C%22%24%7Binput%3Aemail%7D%22%2C%22--api-key%22%2C%22%24%7Binput%3AapiKey%7D%22%5D%7D&quality=insiders)

Or add this to `.vscode/mcp.json` (or your user `mcp.servers` setting). Using `inputs` with `promptString` means your API key is prompted once and kept in VS Code's secret storage instead of sitting in the config file. See the [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more info.

```json
{
  "inputs": [
    { "type": "promptString", "id": "email", "description": "Upstash email" },
    { "type": "promptString", "id": "apiKey", "description": "Upstash API key", "password": true }
  ],
  "servers": {
    "upstash": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "${input:email}",
        "--api-key",
        "${input:apiKey}"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>Google Antigravity</b></summary>

Add this to your Antigravity MCP config. See the [Antigravity MCP docs](https://antigravity.google/docs/mcp) for more info.

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Open Claude Desktop's developer settings and edit `claude_desktop_config.json`. See the [Claude Desktop MCP docs](https://modelcontextprotocol.io/quickstart/user) for more info.

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ]
    }
  }
}
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

Open the Gemini CLI settings file at `~/.gemini/settings.json` and add Upstash to `mcpServers`. See [Gemini CLI Configuration](https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html) for details.

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ]
    }
  }
}
```

</details>

## Example prompts

### Redis

- _"Create a new Redis database in us-east-1"_
- _"List my databases sorted by memory usage"_
- _"Update the user schema by pulling from Redis"_
- _"Create a backup of this db, then clear it"_
- _"Show me throughput spikes during the last 7 days"_

### QStash & Workflow

- _"Check the QStash logs and figure out why my webhook keeps failing"_
- _"Find failed workflow runs for user `@admin` today"_
- _"Retry the failed workflow run that started 2 hours ago"_
- _"Summarize what's in the DLQ right now, grouped by error type"_
- _"Pause the schedules that are throwing errors"_

### Upstash Box

- _"Spin up a Box, clone this repo, and run the tests"_
- _"Snapshot this Box and create 5 copies from it, assign each one a GitHub issue"_
- _"My Box keeps failing to start, check the logs and tell me what's wrong"_

## Upstash Box API key (optional)

For the MCP to interact with [Upstash Box](https://upstash.com/docs/box/overall/quickstart), the agent needs your Box API key. By default you have to paste it into the chat (or keep it in a `.env`) every time the agent runs a Box tool. To avoid this, you can wire the key into the MCP setup itself so the server picks it up automatically on startup.

You can pass it in two ways.

**CLI flag**

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY",
        "--box-api-key",
        "YOUR_BOX_API_KEY"
      ]
    }
  }
}
```

**Environment variable**

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ],
      "env": {
        "UPSTASH_BOX_API_KEY": "YOUR_BOX_API_KEY"
      }
    }
  }
}
```

## Debugging

If the server is misbehaving or a tool keeps failing, enable verbose logging with the `--debug` flag:

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY",
        "--debug"
      ]
    }
  }
}
```

Every internal event is then written to **stderr**, which your MCP client surfaces in its own log viewer. Share the relevant snippet when reporting an issue on [GitHub](https://github.com/upstash/mcp/issues).

## Telemetry

The server sends anonymous diagnostic info to Upstash with each request: the MCP server SDK version, your runtime version (Node, Bun, etc.), and basic platform info (OS and architecture). **No account data, tool arguments, or results are collected.** To opt out, add `--disable-telemetry` to the args.

## Development

Clone the project and run:

```bash
bun i
bun run watch
```

This continuously builds the project and watches for changes.

For testing, create a `.env` file in the project root:

```bash
UPSTASH_EMAIL=<UPSTASH_EMAIL>
UPSTASH_API_KEY=<UPSTASH_API_KEY>
# Optional, for Box tools:
UPSTASH_BOX_API_KEY=<UPSTASH_BOX_API_KEY>
```

To install the local MCP server into Claude Code:

```bash
claude mcp add --transport stdio upstash -- bun --watch dist/index.js --debug
```

To tail logs from the MCP server in real time:

```bash
bun run logs
```
