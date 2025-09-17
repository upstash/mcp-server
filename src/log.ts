export function log(...args: unknown[]) {
  const msg = `[DEBUG ${new Date().toISOString()}] ${args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")}\n`;

  for (const [, logs] of logsStore.entries()) {
    logs.push(msg);
  }

  process.stderr.write(msg);
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
