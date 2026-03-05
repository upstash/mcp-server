// eslint-disable-next-line unicorn/prefer-node-protocol
import { appendFileSync } from "fs";
// eslint-disable-next-line unicorn/prefer-node-protocol
import path from "path";

let debugLogPath: string | null = null;

export function initDebugLog(projectRoot: string) {
  debugLogPath = path.resolve(projectRoot, "upstash-debug.log");
}

export function log(...args: unknown[]) {
  const msg = `[DEBUG ${new Date().toISOString()}] ${args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")}\n`;

  for (const [, logs] of logsStore.entries()) {
    logs.push(msg);
  }

  process.stderr.write(msg);

  if (debugLogPath) {
    try {
      appendFileSync(debugLogPath, msg);
    } catch {
      // ignore file write errors
    }
  }
}

const logsStore = new Map<string, string[]>();

export function startCollectLogs() {
  const id = Array.from({ length: 10 })
    .fill(0)
    .map(() => Math.random().toString(36).slice(2, 15))
    .join("");

  logsStore.set(id, []);

  return id;
}

export function popLogs(id: string) {
  const logs = logsStore.get(id);

  if (!logs) {
    return [];
  }

  logsStore.delete(id);

  return logs;
}
