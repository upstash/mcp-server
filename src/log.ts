// eslint-disable-next-line unicorn/prefer-node-protocol
import { appendFileSync } from "fs";
// eslint-disable-next-line unicorn/prefer-node-protocol
import path from "path";

let debugLogPath: string | null = null;

export function initDebugLog(projectRoot: string) {
  debugLogPath = path.resolve(projectRoot, "upstash-debug.log");
}

// Disable logging entirely under the test runner. E2E tests exercise real
// Upstash APIs, and `log()` would otherwise write full request/response bodies
// (including QStash/Redis tokens) to stderr, which the CI runner captures into
// publicly visible logs. `bun test` sets NODE_ENV=test.
const LOGGING_DISABLED = process.env.NODE_ENV === "test";

export const REDACTED = "***REDACTED***";

// Object keys whose values are secrets and must never be logged, even when
// logging is enabled. Matched case-insensitively. This is a defense-in-depth
// backstop layered on top of NODE_ENV gating and the Authorization masking in
// http.ts — so a stray `log(response)` can't leak a token.
const SENSITIVE_KEYS = new Set([
  "token",
  "read_only_token",
  "rest_token",
  "read_only_rest_token",
  "password",
  "api_key",
  "apikey",
  "box_api_key",
  "secret",
  "authorization",
]);

// Matches the same keys inside an already-serialized JSON string (http.ts logs
// `json(result)`, i.e. a string, not an object), masking the quoted value.
const SENSITIVE_KEYS_STRING_RE = new RegExp(
  `("(?:${[...SENSITIVE_KEYS].join("|")})"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`,
  "gi"
);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redactValue(val);
    }
    return out;
  }
  return value;
}

function redactArg(arg: unknown): string {
  if (typeof arg === "string") {
    // Regex carries the global flag, so replace() masks every match. replaceAll
    // would need lib es2021; the tsconfig targets es2019.
    // eslint-disable-next-line unicorn/prefer-string-replace-all
    return arg.replace(SENSITIVE_KEYS_STRING_RE, `$1"${REDACTED}"`);
  }
  return JSON.stringify(redactValue(arg));
}

/**
 * Builds the redacted log message body from raw args. Exported so the redaction
 * behavior can be unit-tested directly (the `log()` gate on NODE_ENV would
 * otherwise suppress all output under the test runner).
 */
export function redactLogArgs(args: unknown[]): string {
  return args.map((arg) => redactArg(arg)).join(" ");
}

export function log(...args: unknown[]) {
  if (LOGGING_DISABLED) {
    return;
  }

  const msg = `[DEBUG ${new Date().toISOString()}] ${redactLogArgs(args)}\n`;

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
