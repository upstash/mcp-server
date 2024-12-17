import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import chalk from "chalk";
import { fileURLToPath } from "node:url";
import { log } from "./log";
import { config } from "./config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const claudeConfigPath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Claude",
  "claude_desktop_config.json"
);

const UPSTASH_MCP_KEY = "upstash";

export async function init({ executablePath }: { executablePath: string; }) {
  // If the executable path is a local path to the dist/index.js file, use it directly
  // Otherwise, use the name of the package to always load the latest version from remote
  const serverPath = executablePath.includes("dist/index.js") ? executablePath : packageJson.name;

  const upstashConfig = {
    command: "npx",
    args: ["-y", serverPath, "run", config.email, config.apiKey],
  };

  const configDir = path.dirname(claudeConfigPath);
  if (!fs.existsSync(configDir)) {
    log(chalk.blue("Creating Claude config directory..."));
    fs.mkdirSync(configDir, { recursive: true });
  }

  const existingConfig = fs.existsSync(claudeConfigPath)
    ? (JSON.parse(fs.readFileSync(claudeConfigPath, "utf8")) as {
        mcpServers?: Record<string, unknown>;
      })
    : { mcpServers: {} };

  if (UPSTASH_MCP_KEY in (existingConfig?.mcpServers || {})) {
    log(chalk.yellow("Replacing existing Upstash MCP config..."));
  }

  const newConfig = {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      [UPSTASH_MCP_KEY]: upstashConfig,
    },
  };

  fs.writeFileSync(claudeConfigPath, JSON.stringify(newConfig, null, 2));
  log(chalk.green(`Config written to: ${claudeConfigPath}`));
}
