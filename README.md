# Upstash MCP Server

[![smithery badge](https://smithery.ai/badge/@upstash/mcp-server)](https://smithery.ai/server/@upstash/mcp-server)

Model Context Protocol (MCP) is a [new, standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. In this repository, we provide an installer as well as an MCP Server for [Upstash Developer API's](https://upstash.com/docs/devops/developer-api).

This allows you to use any MCP Client to interact with your Upstash account using natural language, e.g.:

- "Create a new Redis database in us-east-1"
- "List my databases"
- "List keys starting with "user:" in users-db"
- "Create a backup"
- "Give me the spikes in throughput during the last 7 days"

# Usage

## Requirements

- Node.js >= v18.0.0
- [Upstash API key](https://upstash.com/docs/devops/developer-api) - You can create one from [here](https://console.upstash.com/account/api).

## How to use locally

### Installing for Claude Desktop

To install Upstash MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@upstash/mcp-server) run the following command:

```bash
npx -y @smithery/cli@latest install @upstash/mcp-server --client claude
```

<details>
  <summary>Install without Smithery</summary>
  
  ```bash
  npx @upstash/mcp-server init <UPSTASH_EMAIL> <UPSTASH_API_KEY>
  ```

This will edit your MCP config file and add an entry for Upstash.

</details>

### Installing for Cursor

To install Upstash MCP Server for Cursor automatically via [Smithery](https://smithery.ai/server/@upstash/mcp-server) run the following command:

```bash
npx -y @smithery/cli@latest install @upstash/mcp-server --client cursor
```

<details>
  <summary>Install without Smithery</summary>
  
  Add the following command to the MCP config in Cursor. For more info, check the [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol#configuring-mcp-servers).

```bash
npx -y @upstash/mcp-server run <UPSTASH_EMAIL> <UPSTASH_API_KEY>
```

</details>

### Installing for Windsurf

To install Upstash MCP Server for Windsurf automatically via [Smithery](https://smithery.ai/server/@upstash/mcp-server) run the following command:

```bash
npx -y @smithery/cli@latest install @upstash/mcp-server --client windsurf
```

<details>
  <summary>Install without Smithery</summary>
  
  Add the following command to the MCP config in Windsurf. For more info, check out the [Windsurf MCP docs](https://docs.windsurf.com/windsurf/mcp#mcp-config-json).

```bash
npx -y @upstash/mcp-server run <UPSTASH_EMAIL> <UPSTASH_API_KEY>
```

</details>

### Running with Docker

You can also use the provided Docker image to run the server.

```bash
docker build -t upstash-mcp .

# Run the stdio server, add this command to you MCP config
docker run --rm -i \
  -e UPSTASH_EMAIL=<UPSTASH_EMAIL> \
  -e UPSTASH_API_KEY=<UPSTASH_API_KEY> \
  upstash-mcp
```

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

This will be used for setting the Claude config and running mcp inspector.

### Testing with Claude Desktop

To install the Claude Desktop config for local development, run the following command:

```bash
pnpm run setup
```

This will add an `upstash` entry to your MCP config file that points to the local build of the package.

```json
{
  "upstash": {
    "command": "node",
    "args": ["<path-to-repo>/dist/index.js", "run", "<UPSTASH_EMAIL>", "<UPSTASH_API_KEY>"]
  }
}
```

> NOTE: The same issue with node version manager applies here. Please look at the note in the usage section if you are using a node version manager.

You can now use Claude Desktop to run Upstash commands.

To view the logs from the MCP Server in real time, run the following command:

```bash
pnpm run logs
```

### Testing with MCP Inspector

You can also use the MCP Inspector to test the tools.

```bash
pnpm run inspector
```
