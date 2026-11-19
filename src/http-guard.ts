import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  localhostAllowedHostnames,
  validateHostHeader,
  validateOriginHeader,
} from "@modelcontextprotocol/server";

/**
 * Every tool call on the HTTP transport runs with the operator's Upstash
 * credentials, so the transport itself has to decide who may call it. This
 * module holds that decision, kept apart from the node:http plumbing so it can
 * be tested directly.
 */

export const DEFAULT_HTTP_HOST = "127.0.0.1";
export const AUTH_TOKEN_ENV = "UPSTASH_MCP_AUTH_TOKEN";

export type HttpGuardOptions = {
  /** Bearer token every /mcp request must carry. */
  authToken: string;
  /**
   * Hostnames the Host header may name. Undefined skips the check, which is
   * only done when the server is bound to a non-loopback interface and the
   * operator named no hosts: the bearer token is then the only gate.
   */
  allowedHosts?: string[];
  /** Hostnames a browser Origin header may name. A missing Origin is allowed. */
  allowedOrigins: string[];
};

export type GuardRejection = { status: 401 | 403; message: string };

type RequestHeaders = {
  host?: string;
  origin?: string;
  authorization?: string;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host) || host.startsWith("127.");
}

export function generateAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildGuardOptions(input: {
  host: string;
  authToken: string;
  extraAllowedHosts?: string[];
  extraAllowedOrigins?: string[];
}): HttpGuardOptions {
  const extraHosts = input.extraAllowedHosts ?? [];
  const localhost = localhostAllowedHostnames();

  // Bound to loopback, the only legitimate Host values are loopback names, so
  // anything else is a DNS rebinding attempt. Bound elsewhere, we cannot guess
  // the names clients use, so the check runs only for hosts the operator named.
  let allowedHosts: string[] | undefined;
  if (isLoopbackHost(input.host)) allowedHosts = [...localhost, ...extraHosts];
  else if (extraHosts.length > 0) allowedHosts = extraHosts;

  return {
    authToken: input.authToken,
    allowedHosts,
    allowedOrigins: [...localhost, ...(input.extraAllowedOrigins ?? [])],
  };
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(authorization: string | undefined, expected: string): boolean {
  if (!authorization) return false;
  const match = /^bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) return false;
  // Hashing first gives equal-length buffers, so the comparison time does not
  // depend on how much of the token is right.
  return timingSafeEqual(sha256(match[1]), sha256(expected));
}

/**
 * Host and Origin checks, which apply to every route (preflight included) so a
 * rebound or cross-origin page learns nothing from the server.
 */
export function checkHostAndOrigin(
  headers: RequestHeaders,
  options: HttpGuardOptions
): GuardRejection | undefined {
  if (options.allowedHosts) {
    const host = validateHostHeader(headers.host, options.allowedHosts);
    if (!host.ok) return { status: 403, message: host.message };
  }

  const origin = validateOriginHeader(headers.origin, options.allowedOrigins);
  if (!origin.ok) return { status: 403, message: origin.message };

  return undefined;
}

/** Full check for an /mcp request: Host, Origin, then the bearer token. */
export function checkMcpRequest(
  headers: RequestHeaders,
  options: HttpGuardOptions
): GuardRejection | undefined {
  const rejection = checkHostAndOrigin(headers, options);
  if (rejection) return rejection;

  if (!tokenMatches(headers.authorization, options.authToken)) {
    return { status: 401, message: "Missing or invalid bearer token" };
  }

  return undefined;
}
