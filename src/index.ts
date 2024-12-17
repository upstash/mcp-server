/* eslint-disable unicorn/no-process-exit */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { init } from "./init.js";
import { log } from "./log.js";
import { server } from "./server.js";
import { config } from "./config.js";
import "dotenv/config";
import { testConnection } from "./test-connection.js";

process.on("uncaughtException", (error) => {
  log("Uncaught exception:", error.name, error.message, error.stack);
});

process.on("unhandledRejection", (error) => {
  if (error instanceof Error) log("Unhandled rejection:", error.name, error.message, error.stack);
  else log("Unhandled rejection:", error);
});

const envApiKey = process.env.UPSTASH_API_KEY;
const envEmail = process.env.UPSTASH_EMAIL;

const USAGE_GENERAL = `Usage: npx @upstash/mcp-server-upstash (init|run) <UPSTASH_EMAIL> <UPSTASH_API_KEY>`;
const USAGE_RUN = `Usage: npx @upstash/mcp-server-upstash run <UPSTASH_EMAIL> <UPSTASH_API_KEY>`;
const USAGE_INIT = `Usage: npx @upstash/mcp-server-upstash init <UPSTASH_EMAIL> <UPSTASH_API_KEY>`;

function parseArguments() {
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

    testConnection();

    init({
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

    testConnection();

    // Start the server
    main().catch((error) => {
      console.error("Server error:", error);
      process.exit(1);
    });
  } else {
    throw new Error(`Unknown command: ${cmd}. Expected 'init' or 'run'. ${USAGE_GENERAL}`);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

try {
  parseArguments();
} catch (error) {
  if (!(error instanceof Error)) throw error;
  console.error(error.message);
  process.exit(1);
}
