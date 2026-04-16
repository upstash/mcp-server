#!/usr/bin/env bun

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { config } from "./config";
import { HttpClient } from "./http";
import { telemetry } from "./telemetry";
import { VERSION } from "./version";

let fetchSpy: ReturnType<typeof spyOn>;
let capturedHeaders: Record<string, string> = {};

beforeEach(() => {
  capturedHeaders = {};
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
  config.disableTelemetry = false;
});

describe("telemetry headers", () => {
  it("sends Upstash-Telemetry-* headers by default", async () => {
    const client = new HttpClient({ baseUrl: "https://api.upstash.com" });
    await client.get("v2/test");

    expect(capturedHeaders["Upstash-Telemetry-Runtime"]).toBe(telemetry.runtime);
    expect(capturedHeaders["Upstash-Telemetry-Platform"]).toBe(telemetry.platform);
    expect(capturedHeaders["Upstash-Telemetry-Sdk"]).toBe(telemetry.sdk);
  });

  it("includes the package version in the Sdk header", async () => {
    const client = new HttpClient({ baseUrl: "https://api.upstash.com" });
    await client.get("v2/test");

    expect(capturedHeaders["Upstash-Telemetry-Sdk"]).toBe(`@upstash/mcp-server@${VERSION}`);
  });

  it("omits telemetry headers when disableTelemetry is true", async () => {
    config.disableTelemetry = true;
    const client = new HttpClient({ baseUrl: "https://api.upstash.com" });
    await client.get("v2/test");

    expect(capturedHeaders["Upstash-Telemetry-Runtime"]).toBeUndefined();
    expect(capturedHeaders["Upstash-Telemetry-Platform"]).toBeUndefined();
    expect(capturedHeaders["Upstash-Telemetry-Sdk"]).toBeUndefined();
  });
});

describe("telemetry values", () => {
  it("detects the bun runtime", () => {
    expect(telemetry.runtime).toMatch(/^bun@/);
  });

  it("reports a platform", () => {
    expect(telemetry.platform).toBeTruthy();
    expect(telemetry.platform).not.toBe("unknown");
  });
});
