export function log(...args: unknown[]) {
  const msg = `[DEBUG ${new Date().toISOString()}] ${args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")}\n`;
  process.stderr.write(msg);
}
