#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { init } from "./init";
import { log } from "./log";
import { server } from "./server";
import { config } from "./config";
import "dotenv/config";
import { testConnection } from "./test-connection";

process.on("uncaughtException", (error) => {
  log("Uncaught exception:", error.name, error.message, error.stack);
});

process.on("unhandledRejection", (error) => {
  if (error instanceof Error) log("Unhandled rejection:", error.name, error.message, error.stack);
  else log("Unhandled rejection:", error);
});

const envApiKey = process.env.UPSTASH_API_KEY;
const envEmail = process.env.UPSTASH_EMAIL;

const USAGE_GENERAL = `Usage: npx @upstash/mcp-server (init|run) <UPSTASH_EMAIL> <UPSTASH_API_KEY>`;
const USAGE_RUN = `Usage: npx @upstash/mcp-server run <UPSTASH_EMAIL> <UPSTASH_API_KEY>`;
const USAGE_INIT = `Usage: npx @upstash/mcp-server init <UPSTASH_EMAIL> <UPSTASH_API_KEY>`;

async function parseArguments() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) throw new Error(USAGE_GENERAL);
  else if (cmd === "init") {
    const [email, apiKey, ...rest] = args;
    const finalApiKey = apiKey || envApiKey;
    const finalEmail = email || envEmail;

    if (rest.length > 0) throw new Error(`Too many arguments. ${USAGE_INIT}`);
    if (!finalApiKey) throw new Error(`Missing API key. ${USAGE_INIT}`);
    if (!finalEmail) throw new Error(`Missing email. ${USAGE_INIT}`);

    config.apiKey = finalApiKey;
    config.email = finalEmail;

    await testConnection();

    await init({
      executablePath: process.argv[1],
    });
  } else if (cmd === "run") {
    const [email, apiKey, ...rest] = args;
    const finalApiKey = apiKey || envApiKey;
    const finalEmail = email || envEmail;

    if (!finalApiKey) throw new Error(`Missing API key. ${USAGE_RUN}`);
    if (!finalEmail) throw new Error(`Missing email. ${USAGE_RUN}`);
    if (rest.length > 0) throw new Error(`Too many arguments. ${USAGE_RUN}`);
    log("Starting MCP server");

    config.apiKey = finalApiKey;
    config.email = finalEmail;

    await testConnection();

    // Start the server
    await main();
  } else {
    throw new Error(`Unknown command: ${cmd}. Expected 'init' or 'run'. ${USAGE_GENERAL}`);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
parseArguments().catch((error) => {
  if (!(error instanceof Error)) throw error;
  console.error(error.message);
  process.exit(1);
});
