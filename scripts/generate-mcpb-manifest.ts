#!/usr/bin/env tsx
/* eslint-disable unicorn/import-style */
/* eslint-disable unicorn/prefer-node-protocol */
/* eslint-disable no-console */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { CustomTool } from '../src/tool';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

interface PackageJson {
  version?: string;
  description?: string;
  name?: string;
  license?: string;
  repository?: {
    url?: string;
  };
  author?: string;
  homepage?: string;
}

interface MCPBTool {
  name: string;
  description: string;
  inputSchema?: any;
}

interface MCPBManifest {
  mcpb_version: string;
  name: string;
  display_name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email: string;
    url: string;
  };
  homepage: string;
  documentation: string;
  icon?: string;
  server: {
    type: string;
    entry_point: string;
    mcp_config: {
      command: string;
      args: string[];
      env: Record<string, string>;
    };
  };
  tools: MCPBTool[];
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    logging: boolean;
  };
  compatibility: {
    platforms: string[];
    runtimes: {
      node: string;
    };
    mcp_protocol_version: string;
  };
  security: {
    requires_credentials: boolean;
    credential_types: string[];
    timeout_ms: number;
    max_concurrent_requests: number;
  };
  keywords: string[];
  license: string;
  repository: {
    type: string;
    url: string;
  };
}

// Read package.json for basic info
const packageJson: PackageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

// Import the source tools to get their definitions
async function generateMCPBManifest(): Promise<void> {
  try {
    // Import the source tools
    const { tools }: { tools: Record<string, CustomTool> } = await import('../src/tools/index.js');
    const { convertToTools } = await import('../src/tool.js');
    
    // Convert tools to MCP format
    const toolsList = convertToTools(tools);
    
    // Generate tools array for manifest with full schema info
    const mcpbTools: MCPBTool[] = toolsList.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    // Generate MCPB manifest
    const manifest: MCPBManifest = {
      "mcpb_version": "1.0",
      "name": "upstash-mcp",
      "display_name": "Upstash MCP Server",
      "version": packageJson.version || "0.1.0",
      "description": packageJson.description || "MCP server for Upstash Redis operations and management",
      "author": {
        "name": "Upstash",
        "email": "support@upstash.com",
        "url": "https://upstash.com"
      },
      "homepage": "https://upstash.com",
      "documentation": "https://github.com/upstash/mcp-server",
      "server": {
        "type": "node",
        "entry_point": "dist/index.js",
        "mcp_config": {
          "command": "node",
          "args": ["${__dirname}/dist/index.js"],
          "env": {
            "UPSTASH_EMAIL": "${UPSTASH_EMAIL}",
            "UPSTASH_API_KEY": "${UPSTASH_API_KEY}"
          }
        }
      },
      "tools": mcpbTools,
      "capabilities": {
        "tools": true,
        "resources": false,
        "prompts": false,
        "logging": true
      },
      "compatibility": {
        "platforms": ["darwin", "win32", "linux"],
        "runtimes": {
          "node": ">=v18.0.0"
        },
        "mcp_protocol_version": "2025-03-26"
      },
      "security": {
        "requires_credentials": true,
        "credential_types": ["UPSTASH_EMAIL", "UPSTASH_API_KEY"],
        "timeout_ms": 30_000,
        "max_concurrent_requests": 10
      },
      "keywords": ["upstash", "redis", "database", "mcp", "server", "cloud", "nosql"],
      "license": packageJson.license || "MIT",
      "repository": {
        "type": "git",
        "url": packageJson.repository?.url || "git+https://github.com/upstash/mcp-server.git"
      }
    };

    // Ensure mcpb directory exists
    mkdirSync(join(projectRoot, 'mcpb'), { recursive: true });

    // Write MCPB manifest.json
    writeFileSync(
      join(projectRoot, 'mcpb', 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Also write to root for packaging
    writeFileSync(
      join(projectRoot, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log('✅ Generated MCPB manifest.json with', mcpbTools.length, 'tools');
    console.log('Tools included:');
    for (const tool of mcpbTools) {
      console.log(`  - ${tool.name}: ${tool.description.slice(0, 80)}${tool.description.length > 80 ? '...' : ''}`);
    }

    console.log('\n📦 MCPB Bundle Information:');
    console.log(`   Name: ${manifest.display_name}`);
    console.log(`   Version: ${manifest.version}`);
    console.log(`   Capabilities: ${Object.entries(manifest.capabilities).filter(([, enabled]) => enabled).map(([cap]) => cap).join(', ')}`);
    console.log(`   Security: ${manifest.security.requires_credentials ? 'Requires credentials' : 'No credentials required'}`);
    console.log(`   Platforms: ${manifest.compatibility.platforms.join(', ')}`);

  } catch (error) {
    console.error('❌ Error generating MCPB manifest:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
generateMCPBManifest();
