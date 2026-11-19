import { describe, expect, it } from "bun:test";
import {
  buildGuardOptions,
  checkHostAndOrigin,
  checkMcpRequest,
  generateAuthToken,
  isLoopbackHost,
} from "./http-guard";

const TOKEN = "test-token";
const loopback = buildGuardOptions({ host: "127.0.0.1", authToken: TOKEN });
const ok = { host: "127.0.0.1:3000", authorization: `Bearer ${TOKEN}` };

describe("checkMcpRequest", () => {
  it("accepts a loopback request with the right token", () => {
    expect(checkMcpRequest(ok, loopback)).toBeUndefined();
    expect(checkMcpRequest({ ...ok, host: "localhost:3000" }, loopback)).toBeUndefined();
    expect(checkMcpRequest({ ...ok, host: "[::1]:3000" }, loopback)).toBeUndefined();
  });

  it("rejects a request without a token", () => {
    expect(checkMcpRequest({ host: ok.host }, loopback)?.status).toBe(401);
  });

  it("rejects a wrong token, a non-bearer scheme and a token prefix", () => {
    expect(checkMcpRequest({ ...ok, authorization: "Bearer wrong" }, loopback)?.status).toBe(401);
    expect(checkMcpRequest({ ...ok, authorization: TOKEN }, loopback)?.status).toBe(401);
    expect(checkMcpRequest({ ...ok, authorization: "Basic dGVzdA==" }, loopback)?.status).toBe(401);
    expect(checkMcpRequest({ ...ok, authorization: "Bearer test" }, loopback)?.status).toBe(401);
  });

  it("rejects a DNS-rebound Host while bound to loopback", () => {
    const rejection = checkMcpRequest({ ...ok, host: "attacker.example:3000" }, loopback);
    expect(rejection?.status).toBe(403);
  });

  it("rejects a cross-origin browser request even with the token", () => {
    const rejection = checkMcpRequest({ ...ok, origin: "https://attacker.example" }, loopback);
    expect(rejection?.status).toBe(403);
  });

  it("accepts a localhost origin and an operator-allowed origin", () => {
    expect(checkMcpRequest({ ...ok, origin: "http://localhost:6274" }, loopback)).toBeUndefined();
    const withOrigin = buildGuardOptions({
      host: "127.0.0.1",
      authToken: TOKEN,
      extraAllowedOrigins: ["app.example.com"],
    });
    expect(
      checkMcpRequest({ ...ok, origin: "https://app.example.com" }, withOrigin)
    ).toBeUndefined();
  });

  it("still requires the token when bound to a non-loopback interface", () => {
    const lan = buildGuardOptions({ host: "0.0.0.0", authToken: TOKEN });
    expect(checkMcpRequest({ host: "192.168.1.10:3000" }, lan)?.status).toBe(401);
    expect(
      checkMcpRequest({ host: "192.168.1.10:3000", authorization: `Bearer ${TOKEN}` }, lan)
    ).toBeUndefined();
  });

  it("checks Host against operator-named hosts on a non-loopback interface", () => {
    const lan = buildGuardOptions({
      host: "0.0.0.0",
      authToken: TOKEN,
      extraAllowedHosts: ["mcp.internal"],
    });
    const auth = `Bearer ${TOKEN}`;
    expect(
      checkMcpRequest({ host: "mcp.internal:3000", authorization: auth }, lan)
    ).toBeUndefined();
    expect(checkMcpRequest({ host: "other:3000", authorization: auth }, lan)?.status).toBe(403);
  });
});

describe("checkHostAndOrigin", () => {
  it("does not need a token, so /ping and preflight work", () => {
    expect(checkHostAndOrigin({ host: "localhost:3000" }, loopback)).toBeUndefined();
  });

  it("rejects a rebound Host on any route", () => {
    expect(checkHostAndOrigin({ host: "attacker.example" }, loopback)?.status).toBe(403);
  });
});

describe("helpers", () => {
  it("detects loopback bind addresses", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("::")).toBe(false);
  });

  it("generates distinct, long tokens", () => {
    const a = generateAuthToken();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(generateAuthToken()).not.toBe(a);
  });
});
