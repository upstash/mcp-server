#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Command } from "commander";
// eslint-disable-next-line unicorn/prefer-node-protocol
import { createServer, type IncomingMessage } from "http";
import { createServerInstance } from "./server.js";
import { config } from "./config";
import { testConnection } from "./test-connection";
import "dotenv/config";

// Parse CLI arguments using commander
const program = new Command()
  .option("--transport <stdio|http>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP transport", "3000")
  .option("--email <email>", "Upstash email")
  .option("--api-key <key>", "Upstash API key")
  .option("--debug", "Enable debug mode")
  .allowUnknownOption(); // let other wrappers pass through extra flags

// Add hidden 'run' command for backwards compatibility: npx @upstash/mcp-server run <email> <api-key>
program
  .command("run <email> <api-key>", { hidden: true })
  .action((email: string, apiKey: string) => {
    (program as any)._legacyArgs = { email, apiKey };
  });

program.parse(process.argv);

// @ts-expect-error - legacy args
const isLegacy = Boolean(program._legacyArgs);
const cliOptions = isLegacy
  ? {
      transport: "stdio",
      port: "3000",
      email: (program as any)._legacyArgs.email,
      apiKey: (program as any)._legacyArgs.apiKey,
      debug: false,
    }
  : program.opts<{
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

// Store SSE transports by session ID
const sseTransports: Record<string, SSEServerTransport> = {};

function getClientIp(req: IncomingMessage): string | undefined {
  // Check both possible header casings
  const forwardedFor = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"];

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ipList = ips.split(",").map((ip: string) => ip.trim());

    // Find the first public IP address
    for (const ip of ipList) {
      const plainIp = ip.replace(/^::ffff:/, "");
      if (
        !plainIp.startsWith("10.") &&
        !plainIp.startsWith("192.168.") &&
        !/^172\.(1[6-9]|2\d|3[01])\./.test(plainIp)
      ) {
        return plainIp;
      }
    }
    // If all are private, use the first one
    return ipList[0].replace(/^::ffff:/, "");
  }

  // Fallback: use remote address, strip IPv6-mapped IPv4
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress.replace(/^::ffff:/, "");
  }
  return undefined;
}

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
      const url = new (globalThis as any).URL(req.url || "", `http://${req.headers.host}`).pathname;

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
        // Extract client IP address using socket remote address (most reliable)
        const _clientIp = getClientIp(req);

        // Create new server instance for each request
        const requestServer = createServerInstance();

        if (url === "/mcp") {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
          await requestServer.connect(transport);
          await transport.handleRequest(req, res);
        } else if (url === "/sse" && req.method === "GET") {
          // Create new SSE transport for GET request
          const sseTransport = new SSEServerTransport("/messages", res);
          // Store the transport by session ID
          sseTransports[sseTransport.sessionId] = sseTransport;
          // Clean up transport when connection closes
          res.on("close", () => {
            delete sseTransports[sseTransport.sessionId];
          });
          await requestServer.connect(sseTransport);
        } else if (url === "/messages" && req.method === "POST") {
          // Get session ID from query parameters
          const sessionId =
            new (globalThis as any).URL(
              req.url || "",
              `http://${req.headers.host}`
            ).searchParams.get("sessionId") ?? "";

          if (!sessionId) {
            res.writeHead(400);
            res.end("Missing sessionId parameter");
            return;
          }

          // Get existing transport for this session
          const sseTransport = sseTransports[sessionId];
          if (!sseTransport) {
            res.writeHead(400);
            res.end(`No transport found for sessionId: ${sessionId}`);
            return;
          }

          // Handle the POST message with the existing transport
          await sseTransport.handlePostMessage(req, res);
        } else if (url === "/ping") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("pong");
        } else {
          res.writeHead(404);
          res.end("Not found");
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
          `Upstash MCP Server running on ${transportType.toUpperCase()} at http://localhost:${actualPort}/mcp with SSE endpoint at /sse`
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
