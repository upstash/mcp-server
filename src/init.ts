/* eslint-disable unicorn/prefer-node-protocol */
import path from "path";
import os from "os";
import fs from "fs";
import chalk from "chalk";

import { fileURLToPath } from "url";
import { log } from "./log";
import { config } from "./config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const claudeConfigPath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Claude",
  "claude_desktop_config.json"
);

const UPSTASH_MCP_KEY = "upstash";

export async function init({ executablePath }: { executablePath: string }) {
  const isLocal = executablePath.includes("dist/index.js");
  const upstashConfig = isLocal
    ? {
        command: "node",
        args: [executablePath, "run", config.email, config.apiKey],
      }
    : {
        command: "npx",
        args: ["-y", "@upstash/mcp-server-upstash", "run", config.email, config.apiKey],
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
    log(chalk.yellow("Upstash entry already exists. Overriding it."));
  }

  if (isLocal) {
    log(
      chalk.yellow(
        "Local executable detected. Using 'node' and absolute path instead of 'npx' for development."
      )
    );
  }

  const newConfig = {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      [UPSTASH_MCP_KEY]: upstashConfig,
    },
  };

  fs.writeFileSync(claudeConfigPath, JSON.stringify(newConfig, null, 2));

  log(
    chalk.blue(
      "\n" +
        JSON.stringify(
          {
            [UPSTASH_MCP_KEY]: upstashConfig,
          },
          null,
          2
        ).replaceAll(config.apiKey, "********")
    )
  );
  log(chalk.green(`Config written to: "${claudeConfigPath.replace(os.homedir(), "~")}"`));
}
