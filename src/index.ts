#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Command } from "commander";
// eslint-disable-next-line unicorn/prefer-node-protocol
import { createServer, type IncomingMessage } from "http";
import { createServerInstance } from "./server.js";
import { config } from "./config";
import { testConnection } from "./test-connection";
import "dotenv/config";

/**
 * Last version of the MCP server required "run" command to be used.
 * This is a backwards compatibility fix to allow the MCP server to be used with the old command.
 */

// Handle legacy 'run' command format before parsing
let argv = process.argv.slice(2);

// Check for legacy format and transform it to the new format
if (argv.length >= 3 && argv[0] === "run") {
  argv = ["--email", argv[1], "--api-key", argv[2], ...argv.slice(3)];
}

const program = new Command()
  .option("--transport <stdio|http>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP transport", "3000")
  .option("--email <email>", "Upstash email")
  .option("--api-key <key>", "Upstash API key")
  .option("--debug", "Enable debug mode")
  .allowUnknownOption(); // let other wrappers pass through extra flags

program.parse(argv, { from: "user" });

const cliOptions = program.opts<{
  transport: string;
  port: string;
  email?: string;
  apiKey?: string;
  debug?: boolean;
}>();

export const DEBUG = cliOptions.debug ?? false;

// Validate transport option
const allowedTransports = ["stdio", "http"];
if (!allowedTransports.includes(cliOptions.transport)) {
  console.error(
    `Invalid --transport value: '${cliOptions.transport}'. Must be one of: stdio, http.`
  );
  process.exit(1);
}

// Transport configuration
const TRANSPORT_TYPE = (cliOptions.transport || "stdio") as "stdio" | "http";

// Disallow incompatible flags based on transport
const passedPortFlag = process.argv.includes("--port");

if (TRANSPORT_TYPE === "stdio" && passedPortFlag) {
  console.error("The --port flag is not allowed when using --transport stdio.");
  process.exit(1);
}

// HTTP port configuration
const CLI_PORT = (() => {
  const parsed = Number.parseInt(cliOptions.port, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
})();

async function main() {
  // Get credentials from CLI options or environment
  const email = cliOptions.email || process.env.UPSTASH_EMAIL;
  const apiKey = cliOptions.apiKey || process.env.UPSTASH_API_KEY;

  if (!email || !apiKey) {
    console.error(
      "Missing required credentials. Provide --email and --api-key or set UPSTASH_EMAIL and UPSTASH_API_KEY environment variables."
    );
    process.exit(1);
  }

  // Set config
  config.email = email;
  config.apiKey = apiKey;

  // Test connection
  await testConnection();

  const transportType = TRANSPORT_TYPE;

  if (transportType === "http") {
    // Get initial port from environment or use default
    const initialPort = CLI_PORT ?? 3000;
    // Keep track of which port we end up using
    let actualPort = initialPort;
    const httpServer = createServer(async (req: IncomingMessage, res: any) => {
      const pathname = new (globalThis as any).URL(req.url || "", `http://${req.headers.host}`)
        .pathname;

      // Set CORS headers for all responses
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, MCP-Session-Id, MCP-Protocol-Version, X-Upstash-API-Key, Upstash-API-Key, X-API-Key, Authorization"
      );
      res.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id");

      // Handle preflight OPTIONS requests
      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        // Create new server instance for each request
        const requestServer = createServerInstance();

        if (pathname === "/mcp") {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
          await requestServer.connect(transport);
          await transport.handleRequest(req, res);
        } else if (pathname === "/ping") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", message: "pong" }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found", status: 404 }));
        }
      } catch (error) {
        console.error("Error handling request:", error);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      }
    });

    // Function to attempt server listen with port fallback
    const startServer = (port: number, maxAttempts = 10) => {
      httpServer.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && port < initialPort + maxAttempts) {
          console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
          startServer(port + 1, maxAttempts);
        } else {
          console.error(`Failed to start server: ${err.message}`);
          process.exit(1);
        }
      });

      httpServer.listen(port, () => {
        actualPort = port;
        console.error(
          `Upstash MCP Server running on ${transportType.toUpperCase()} at http://localhost:${actualPort}/mcp`
        );
      });
    };

    // Start the server with initial port
    startServer(initialPort);
  } else {
    // Stdio transport - this is already stateless by nature
    const server = createServerInstance();
    const transport = new StdioServerTransport();

    // Log the RCP messages coming to the transport
    // const originalOnmessage = transport.onmessage;
    // transport.onmessage = (message) => {
    //   console.error("message", message);

    //   originalOnmessage?.(message);
    // };

    await server.connect(transport);
    console.error("Upstash MCP Server running on stdio");
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
