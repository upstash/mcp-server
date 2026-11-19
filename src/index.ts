#!/usr/bin/env node

import { createMcpHandler } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { Command } from "commander";
// eslint-disable-next-line unicorn/prefer-node-protocol
import path from "node:path";
import { createServer, type IncomingMessage } from "node:http";
import { createServerInstance } from "./server.js";
import { config } from "./config";
import { testBoxConnection, testConnection } from "./test-connection";
import { initDebugLog } from "./log";
import {
  AUTH_TOKEN_ENV,
  DEFAULT_HTTP_HOST,
  buildGuardOptions,
  checkHostAndOrigin,
  checkMcpRequest,
  generateAuthToken,
  isLoopbackHost,
  type GuardRejection,
} from "./http-guard";
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
  .option(
    "--host <address>",
    "interface the HTTP transport binds to. Anything other than loopback exposes your Upstash account to that network",
    DEFAULT_HTTP_HOST
  )
  .option(
    "--auth-token <token>",
    `bearer token HTTP clients must send (or set ${AUTH_TOKEN_ENV}). A random one is generated when omitted`
  )
  .option(
    "--allowed-host <hostname...>",
    "extra hostnames the HTTP Host header may name (loopback names are always allowed when bound to loopback)"
  )
  .option(
    "--allowed-origin <hostname...>",
    "extra browser Origin hostnames allowed to call the HTTP transport (localhost is always allowed)"
  )
  .option("--email <email>", "Upstash email")
  .option("--api-key <key>", "Upstash API key")
  .option("--box-api-key <key>", "Upstash Box API key (optional)")
  .option("--debug", "Enable debug mode")
  .option("--disable-telemetry", "Disable telemetry headers sent to Upstash APIs")
  .option(
    "--upload-root <path...>",
    "Restrict box_upload to these directories. Required to offer box_upload over --transport http, which reads the server host's filesystem"
  )
  .allowUnknownOption(); // let other wrappers pass through extra flags

program.parse(argv, { from: "user" });

const cliOptions = program.opts<{
  transport: string;
  port: string;
  host: string;
  authToken?: string;
  allowedHost?: string[];
  allowedOrigin?: string[];
  email?: string;
  apiKey?: string;
  boxApiKey?: string;
  debug?: boolean;
  disableTelemetry?: boolean;
  uploadRoot?: string[];
}>();

export const DEBUG = cliOptions.debug ?? false;

if (DEBUG) {
  initDebugLog(new URL("../", import.meta.url).pathname);
}

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
if (TRANSPORT_TYPE === "stdio") {
  for (const flag of ["--port", "--host", "--auth-token", "--allowed-host", "--allowed-origin"]) {
    if (process.argv.includes(flag)) {
      console.error(`The ${flag} flag is not allowed when using --transport stdio.`);
      process.exit(1);
    }
  }
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
  const boxApiKey = cliOptions.boxApiKey || process.env.UPSTASH_BOX_API_KEY || "";

  // Box is a separate credential on a separate API, so a Box-only customer may
  // have no account key at all. Requiring one would block them from a server
  // whose Box tools never touch the account API.
  const hasAccountKey = Boolean(email && apiKey);

  if (!hasAccountKey && !boxApiKey) {
    console.error(
      "Missing required credentials. Provide --email and --api-key (or set UPSTASH_EMAIL and UPSTASH_API_KEY) for Redis, QStash and Workflow tools, or --box-api-key alone to use only the Upstash Box tools."
    );
    process.exit(1);
  }

  // Set config
  config.email = email ?? "";
  config.apiKey = apiKey ?? "";
  config.boxApiKey = boxApiKey;
  config.disableTelemetry = cliOptions.disableTelemetry ?? false;
  config.transport = TRANSPORT_TYPE;
  config.uploadRoots = (cliOptions.uploadRoot ?? []).map((root) => path.resolve(root));

  // Each credential is checked against its own API, independently of the other.
  if (hasAccountKey) await testConnection();
  if (boxApiKey) await testBoxConnection();

  const transportType = TRANSPORT_TYPE;

  if (transportType === "http") {
    // Get initial port from environment or use default
    const initialPort = CLI_PORT ?? 3000;
    // Keep track of which port we end up using
    let actualPort = initialPort;
    const host = cliOptions.host || DEFAULT_HTTP_HOST;

    // Every tool call runs with the operator's credentials, so no caller gets
    // in without the token. An explicit one survives restarts; otherwise a
    // fresh one is printed for the operator to give their client.
    const explicitToken = cliOptions.authToken || process.env[AUTH_TOKEN_ENV];
    const authToken = explicitToken || generateAuthToken();
    const guard = buildGuardOptions({
      host,
      authToken,
      extraAllowedHosts: cliOptions.allowedHost,
      extraAllowedOrigins: cliOptions.allowedOrigin,
    });

    const reject = (res: any, rejection: GuardRejection) => {
      res.writeHead(rejection.status, {
        "Content-Type": "application/json",
        ...(rejection.status === 401 ? { "WWW-Authenticate": "Bearer" } : {}),
      });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32_000, message: rejection.message },
          id: null,
        })
      );
    };

    // One fetch-shaped MCP handler for the process; it calls the factory once
    // per request, so serving stays stateless as it was before.
    const mcpNodeHandler = toNodeHandler(
      createMcpHandler(() => createServerInstance(), {
        onerror: (error) => console.error("MCP handler error:", error),
      }),
      { onerror: (error) => console.error("MCP request error:", error) }
    );

    const httpServer = createServer(async (req: IncomingMessage, res: any) => {
      const pathname = new (globalThis as any).URL(req.url || "", `http://${req.headers.host}`)
        .pathname;

      const headers = {
        host: req.headers.host,
        origin: req.headers.origin,
        authorization: req.headers.authorization,
      };

      // Host and Origin are checked on every route, preflight included, so a
      // DNS-rebound or cross-origin page gets nothing back.
      const hostOrOriginRejection = checkHostAndOrigin(headers, guard);
      if (hostOrOriginRejection) {
        reject(res, hostOrOriginRejection);
        return;
      }

      // CORS only for an Origin that passed the allow-list, never a wildcard.
      if (headers.origin) {
        res.setHeader("Access-Control-Allow-Origin", headers.origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, MCP-Session-Id, MCP-Protocol-Version, Authorization"
        );
        res.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id");
      }

      // Handle preflight OPTIONS requests
      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        if (pathname === "/mcp") {
          const authRejection = checkMcpRequest(headers, guard);
          if (authRejection) {
            reject(res, authRejection);
            return;
          }
          // The handler builds a fresh server instance for each request
          await mcpNodeHandler(req, res);
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

      httpServer.listen(port, host, () => {
        actualPort = port;
        const displayHost = host.includes(":") ? `[${host}]` : host;
        console.error(
          `Upstash MCP Server running on ${transportType.toUpperCase()} at http://${displayHost}:${actualPort}/mcp`
        );
        if (explicitToken) {
          console.error("Clients must send: Authorization: Bearer <your --auth-token>");
        } else {
          console.error(`Clients must send: Authorization: Bearer ${authToken}`);
          console.error(
            `This token changes on every start. Pass --auth-token or set ${AUTH_TOKEN_ENV} to keep one.`
          );
        }
        if (!isLoopbackHost(host)) {
          console.warn(
            `WARNING: bound to ${host}, not loopback. Anyone on that network who has the token can act on your Upstash account.`
          );
        }
      });
    };

    // Start the server with initial port
    startServer(initialPort);
  } else {
    // Stdio transport - this is already stateless by nature
    serveStdio(() => createServerInstance(), {
      onerror: (error) => console.error("MCP stdio error:", error),
    });
    console.error("Upstash MCP Server running on stdio");
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
