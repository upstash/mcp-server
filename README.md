# Upstash MCP

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=upstash&config=eyJjb21tYW5kIjoibnB4IC15IEB1cHN0YXNoL21jcC1zZXJ2ZXJAbGF0ZXN0IC0tZW1haWwgWU9VUl9FTUFJTCAtLWFwaS1rZXkgWU9VUl9BUElfS0VZIn0%3D)

[<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/Install%20in%20VS%20Code-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22upstash-mcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Fmcp-server%40latest%22%2C%22--email%22%2C%22YOUR_EMAIL%22%2C%22--api-key%22%2C%22YOUR_API_KEY%22%5D%7D)

[![smithery badge](https://smithery.ai/badge/@upstash/mcp-server)](https://smithery.ai/server/@upstash/mcp-server)

The Upstash MCP gives your agent the ability to interact with your Upstash account, such as:

### Redis

- "Create a new Redis in us-east-1"
- "List my databases that have high memory usage"
- "Give me the schema of how users are stored in redis"
- "Create a backup and clear db"
- "Give me the spikes in throughput during the last 7 days"

### QStash & Workflow

- "Check the logs and figure out what is wrong"
- "Find me failed workflows of user @ysfk_0x"
- "Restart the failed workflow run started in last 2 hours"
- "Check DLQ and give me a summary"

# Usage

## Quick Setup

First, get your Upstash credentials:

- **Email**: Your Upstash account email
- **API Key**: Get it from [Upstash Console → Account → API Keys](https://console.upstash.com/account/api)

Add this to your MCP client configuration:

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

### Claude Code

```bash
claude mcp add --transport stdio upstash -- npx -y @upstash/mcp-server@latest --email YOUR_EMAIL --api-key YOUR_API_KEY
```

### Streamable HTTP Transport (for web applications)

Start your MCP server with the `http` transport:

```bash
npx @upstash/mcp-server@latest --transport http --port 3000 --email YOUR_EMAIL --api-key YOUR_API_KEY
```

And configure your MCP client to use the HTTP transport:

```json
{
  "mcpServers": {
    "upstash": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Telemetry

The server sends anonymous runtime/platform info to Upstash with each request. To opt out, add `--disable-telemetry` to your args.

## Troubleshooting

See the [troubleshooting guide](https://modelcontextprotocol.io/quickstart#troubleshooting) in the official MCP documentation. You can also reach out to us at [Discord](https://discord.com/invite/w9SenAtbme) for support.

## Development

Clone the project and run:

```bash
bun i
bun run watch
```

This will continuously build the project and watch for changes.

For testing, you can create a `.env` file in the same directory as the project with the following content:

```bash
UPSTASH_EMAIL=<UPSTASH_EMAIL>
UPSTASH_API_KEY=<UPSTASH_API_KEY>
```

To install the local MCP Server to Claude Code, run:

```bash
claude mcp add --transport stdio upstash -- bun --watch dist/index.js
```

To view the logs from the MCP Server in real time, run:

```bash
bun run logs
```
