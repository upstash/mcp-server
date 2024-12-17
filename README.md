# Upstash MCP Server

Model Context Protocol (MCP) is a [new, standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. In this repository, we provide an installer as well as an MCP Server for [Upstash Developer API's](https://upstash.com/docs/devops/developer-api).

This lets you use Claude Desktop, or any MCP Client, to use natural language to accomplish things on your Upstash account, e.g.:

- "Create a new Redis database with 1GB of memory"
- "List all databases"
- "See keys starting with "user:" in users-db"
- "Create a backup"

# Usage

## Requirements

- Node.js >= v18.0.0
- Claude Desktop
- [Upstash API key](https://upstash.com/docs/devops/developer-api) - You can create one from [here](https://console.upstash.com/account/api).

## How to use locally

1. Run `npx @upstash/mcp-server-upstash init <UPSTASH_EMAIL> <UPSTASH_API_KEY>`
2. Restart Claude Desktop
3. You should now be able to use Upstash commands in Claude Desktop

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

## Development

Clone the project and run:

```bash
bun install
npm run watch
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
npm run install
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

You can now use Claude Desktop to run Upstash commands.

To view the logs from the MCP Server in real time, run the following command:

```bash
npm run logs
```

### Testing with MCP Inspector

You can also use the MCP Inspector to test the tools.

```bash
npm run inspector
```
