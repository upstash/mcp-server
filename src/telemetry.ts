import { VERSION } from "./version.js";

function getRuntime(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).Bun !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return `bun@${(globalThis as any).Bun.version}`;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).Deno !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const denoVersion = (globalThis as any).Deno?.version?.deno;
    return denoVersion ? `deno@${denoVersion}` : "deno";
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    return `node@${process.versions.node}`;
  }
  return "unknown";
}

function getPlatform(): string {
  if (typeof process !== "undefined" && process.platform) {
    return process.platform;
  }
  return "unknown";
}

export const telemetry = {
  runtime: getRuntime(),
  platform: getPlatform(),
  sdk: `@upstash/mcp-server@${VERSION}`,
};
