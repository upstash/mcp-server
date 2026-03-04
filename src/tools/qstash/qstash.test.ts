#!/usr/bin/env bun

import { describe, it, expect, beforeAll } from "bun:test";
import { config } from "../../config";
import { qstashTools } from "./qstash";

beforeAll(() => {
  const email = process.env.UPSTASH_EMAIL;
  const apiKey = process.env.UPSTASH_API_KEY;
  if (!email || !apiKey) {
    throw new Error("UPSTASH_EMAIL and UPSTASH_API_KEY must be set in .env file");
  }
  config.email = email;
  config.apiKey = apiKey;
});

describe("qstash_get_user_token", () => {
  it("returns the token from v2/qstash/user", async () => {
    const result = await qstashTools.qstash_get_user_token.handler(undefined as never);
    const text = Array.isArray(result) ? result.join("") : String(result);
    expect(text).toContain("token");
  });
});

describe("qstash_schedules_list", () => {
  it("lists schedules and returns count", async () => {
    const result = await qstashTools.qstash_schedules_list.handler({} as never);
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ schedules/);
  });
});

describe("qstash_logs_list", () => {
  it("lists logs and returns entries", async () => {
    const result = await qstashTools.qstash_logs_list.handler({ count: 5 } as never);
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ log entries/);
  });
});

describe("qstash_publish_message", () => {
  it("publishes a message and returns a messageId", async () => {
    const result = await qstashTools.qstash_publish_message.handler({
      destination: "https://httpbin.org/post",
      body: JSON.stringify({ test: true }),
      method: "POST",
    } as never);
    expect(Array.isArray(result)).toBe(true);
    const text = (result as string[]).join("\n");
    expect(text).toContain("Message published successfully");
    expect(text).toContain("messageId");
  });
});
