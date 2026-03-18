#!/usr/bin/env bun

import { describe, it, expect, beforeAll } from "bun:test";
import { config } from "../../config";
import type { CustomTool } from "../../tool";
import { qstashTools } from "./qstash";
import { workflowTools } from "./workflow";
import { clearTokenCache } from "./utils";

const tools = { ...qstashTools, ...workflowTools } as Record<string, CustomTool<any>>;

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
    const result = await tools.qstash_get_user_token.handler({});
    const text = Array.isArray(result) ? result.join("") : String(result);
    expect(text).toContain("token");
  });
});

describe("qstash_schedules_list", () => {
  it("lists schedules (eu)", async () => {
    const result = await tools.qstash_schedules_list.handler({});
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ schedules/);
  });

  it("lists schedules (us)", async () => {
    clearTokenCache();
    const result = await tools.qstash_schedules_list.handler({ region: "us" });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ schedules/);
  });
});

describe("qstash_logs_list", () => {
  it("lists logs (eu)", async () => {
    const result = await tools.qstash_logs_list.handler({ count: 5 });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ log entries/);
  });

  it("lists logs (us)", async () => {
    clearTokenCache();
    const result = await tools.qstash_logs_list.handler({ count: 5, region: "us" });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ log entries/);
  });
});

describe("qstash_dlq_list", () => {
  it("lists dlq (eu)", async () => {
    const result = await tools.qstash_dlq_list.handler({ count: 5 });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ DLQ messages/);
  });

  it("lists dlq (us)", async () => {
    clearTokenCache();
    const result = await tools.qstash_dlq_list.handler({ count: 5, region: "us" });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ DLQ messages/);
  });
});

describe("qstash_publish_message", () => {
  it("publishes a message (eu)", async () => {
    const result = await tools.qstash_publish_message.handler({
      destination: "https://httpbin.org/post",
      body: JSON.stringify({ test: true }),
      method: "POST",
    });
    expect(Array.isArray(result)).toBe(true);
    const text = (result as string[]).join("\n");
    expect(text).toContain("Message published successfully");
    expect(text).toContain("messageId");
  });

  it("publishes a message (us)", async () => {
    clearTokenCache();
    const result = await tools.qstash_publish_message.handler({
      destination: "https://httpbin.org/post",
      body: JSON.stringify({ test: true }),
      method: "POST",
      region: "us",
    });
    expect(Array.isArray(result)).toBe(true);
    const text = (result as string[]).join("\n");
    expect(text).toContain("Message published successfully");
    expect(text).toContain("messageId");
  });
});

describe("workflow_logs_list", () => {
  it("lists workflow logs (eu)", async () => {
    const result = await tools.workflow_logs_list.handler({ count: 3 });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ workflow runs/);
  });

  it("lists workflow logs (us)", async () => {
    clearTokenCache();
    const result = await tools.workflow_logs_list.handler({ count: 3, region: "us" });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ workflow runs/);
  });
});

describe("workflow_dlq_list", () => {
  it("lists workflow dlq (eu)", async () => {
    const result = await tools.workflow_dlq_list.handler({ count: 3 });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ failed workflow runs/);
  });

  it("lists workflow dlq (us)", async () => {
    clearTokenCache();
    const result = await tools.workflow_dlq_list.handler({ count: 3, region: "us" });
    expect(Array.isArray(result)).toBe(true);
    const [summary] = result as string[];
    expect(summary).toMatch(/Found \d+ failed workflow runs/);
  });
});
