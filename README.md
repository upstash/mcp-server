# Upstash MCP Server

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=upstash-mcp&config=eyJjb21tYW5kIjoibm9kZSIsImFyZ3MiOlsiL3BhdGgvdG8vdXBzdGFzaC1tY3AvaW5kZXguanMiLCItLWVtYWlsIiwiWU9VUl9FTUFJTF9IRVJFIiwiLS1hcGkta2V5IiwiWU9VUl9BUElfS0VZX0hFUkUiXX0%3D) [<img alt="Install in VS Code (npx)" src="https://img.shields.io/badge/Install%20in%20VS%20Code-0098FF?style=for-the-badge&logo=visualstudiocode&logoColor=white">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22upstash-mcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40upstash%2Fmcp-server%40latest%22%2C%22--email%22%2C%22YOUR_EMAIL%22%2C%22--api-key%22%2C%22YOUR_API_KEY%22%5D%7D)

[![smithery badge](https://smithery.ai/badge/@upstash/mcp-server)](https://smithery.ai/server/@upstash/mcp-server)

Model Context Protocol (MCP) is a [new, standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. In this repository, we provide an installer as well as an MCP Server for [Upstash Developer API's](https://upstash.com/docs/devops/developer-api).

This allows you to use any MCP Client to interact with your Upstash account using natural language, e.g.:

- "Create a new Redis database in us-east-1"
- "List my databases"
- "List keys starting with "user:" in users-db"
- "Create a backup"
- "Give me the spikes in throughput during the last 7 days"

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

**HTTP Transport (for web applications):**

```json
{
  "mcpServers": {
    "upstash": {
      "command": "npx",
      "args": [
        "-y",
        "@upstash/mcp-server@latest",
        "--transport",
        "http",
        "--port",
        "3000",
        "--email",
        "YOUR_EMAIL",
        "--api-key",
        "YOUR_API_KEY"
      ]
    }
  }
}
```

The server will be available at `http://localhost:3000/mcp` with SSE endpoint at `/sse`.

<details>
<summary><strong>Docker Setup</strong></summary>

1. **Create a Dockerfile:**

   <summary>Click to see Dockerfile content</summary>

   ```Dockerfile
   FROM node:18-alpine

   WORKDIR /app

   # Install the latest version globally
   RUN npm install -g @upstash/mcp-server

   # Expose default port if needed (optional, depends on MCP client interaction)
   # EXPOSE 3000

   # Default command to run the server
   CMD ["upstash-mcp-server"]
   ```

   </details>

   Then, build the image using a tag (e.g., `upstash-mcp`). **Make sure Docker Desktop (or the Docker daemon) is running.** Run the following command in the same directory where you saved the `Dockerfile`:

   ```bash
   docker build -t upstash-mcp .
   ```

2. **Configure Your MCP Client:**

   Update your MCP client's configuration to use the Docker command.

   _Example for a claude_desktop_config.json:_

   ```json
   {
     "mcpServers": {
       "upstash": {
         "command": "docker",
         "args": [
           "run",
           "-i",
           "--rm",
           "-e",
           "UPSTASH_EMAIL=YOUR_EMAIL",
           "-e",
           "UPSTASH_API_KEY=YOUR_API_KEY",
           "upstash-mcp"
         ]
       }
     }
   }
   ```

   _Note: This is an example configuration. Please refer to the specific examples for your MCP client (like Cursor, VS Code, etc.) earlier in this README to adapt the structure (e.g., `mcpServers` vs `servers`). Also, ensure the image name in `args` matches the tag used during the `docker build` command._

</details>

## Requirements

- Node.js >= v18.0.0
- [Upstash API key](https://upstash.com/docs/devops/developer-api) - You can create one from [here](https://console.upstash.com/account/api).

### Troubleshooting

#### Common Issues

Your mcp client might have trouble finding the right binaries because of the differences between your shell and system `PATH`.

To fix this, you can get the full path of the binaries by running `which npx` or `which docker` in your shell, and replace the `npx` or `docker` command in the MCP config with the full binary path.

#### Node Version Manager

If you are using a node version manager like nvm or fnm, please check [this issue](https://github.com/modelcontextprotocol/servers/issues/64#issuecomment-2530337743). You should change the `node` command in the MCP config to the absolute path of the node binary.

#### Additional Troubleshooting

See the [troubleshooting guide](https://modelcontextprotocol.io/quickstart#troubleshooting) in the MCP documentation. You can also reach out to us at [Discord](https://discord.com/invite/w9SenAtbme).

## Tools

### Redis

- `redis_database_create_backup`
- `redis_database_create_new`
- `redis_database_delete`
- `redis_database_delete_backup`
- `redis_database_get_details`
- `redis_database_list_backups`
- `redis_database_list_databases`
- `redis_database_reset_password`
- `redis_database_restore_backup`
- `redis_database_run_multiple_redis_commands`
- `redis_database_run_single_redis_command`
- `redis_database_set_daily_backup`
- `redis_database_update_regions`
- `redis_database_get_usage_last_5_days`
- `redis_database_get_stats`

## Development

Clone the project and run:

```bash
pnpm install
pnpm run watch
```

This will continuously build the project and watch for changes.

For testing, you can create a `.env` file in the same directory as the project with the following content:

```bash
UPSTASH_EMAIL=<UPSTASH_EMAIL>
UPSTASH_API_KEY=<UPSTASH_API_KEY>
```

This will be used for setting the Claude config.

### Testing with Claude Desktop

To install the Claude Desktop config for local development, add the following to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "upstash": {
      "command": "node",
      "args": [
        "<path-to-repo>/dist/index.js",
        "run",
        "--email",
        "<UPSTASH_EMAIL>",
        "--api-key",
        "<UPSTASH_API_KEY>"
      ]
    }
  }
}
```

> NOTE: The same issue with node version manager applies here. Please look at the note in the usage section if you are using a node version manager.

You can now use Claude Desktop to run Upstash commands.

To view the logs from the MCP Server in real time, run the following command:

```bash
pnpm run logs
```
