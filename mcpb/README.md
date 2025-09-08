# Upstash MCP Server Bundle

This is an MCP Bundle (MCPB) for the Upstash MCP Server, providing comprehensive Redis database management capabilities for AI assistants.

## Features

### Database Operations
- Create, delete, and list Redis databases
- Get detailed database information and statistics
- Update read regions for global databases
- Reset database passwords

### Backup Management
- Create, restore, and delete database backups
- List all backups for a database
- Configure daily backup schedules

### Redis Commands
- Execute single Redis commands
- Run multiple commands in batch
- Optimized for discovery operations (SCAN over KEYS)

### Usage Analytics
- Get precise 5-day usage statistics
- Monitor sampled performance metrics
- Track throughput, latency, and disk usage

## Requirements

- Node.js >= 18.0.0
- Upstash account with API credentials

## Environment Variables

- `UPSTASH_EMAIL`: Your Upstash account email
- `UPSTASH_API_KEY`: Your Upstash API key

## Security

- Requires valid Upstash credentials
- 30-second timeout for operations
- Maximum 10 concurrent requests
- Secure credential handling

## Installation

This bundle is designed to be used with MCP-compatible AI assistants that support MCPB format.

## Support

For issues and support, visit: https://github.com/upstash/mcp-server
