#!/usr/bin/env bun

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { config } from "./config";
import { testConnection } from "./test-connection";
import { redisDbOpsTools } from "./tools/redis/db";
import { redisCommandTools } from "./tools/redis/command";
import { redisBackupTools } from "./tools/redis/backup";
import { qstashTools } from "./tools/qstash/qstash";
import { workflowTools } from "./tools/qstash/workflow";
import { clearTokenCache } from "./tools/qstash/utils";
import { http } from "./http";
import type { RedisDatabase } from "./tools/redis/types";
import type { CustomTool } from "./tool";

const redisTools = { ...redisDbOpsTools, ...redisCommandTools, ...redisBackupTools } as Record<
  string,
  CustomTool<any>
>;
const qstashAllTools = { ...qstashTools, ...workflowTools } as Record<string, CustomTool<any>>;

// Save original config to restore after tests
let originalEmail: string;
let originalApiKey: string;
let originalReadonly: boolean;

beforeAll(async () => {
  const email = process.env.UPSTASH_EMAIL;
  const readonlyKey = process.env.UPSTASH_API_KEY_READONLY;

  if (!email || !readonlyKey) {
    throw new Error("UPSTASH_EMAIL and UPSTASH_API_KEY_READONLY must be set in .env file");
  }

  // Save original config
  originalEmail = config.email;
  originalApiKey = config.apiKey;
  originalReadonly = config.readonly;

  // Set readonly credentials
  config.email = email;
  config.apiKey = readonlyKey;
  config.readonly = false; // Reset so testConnection can detect it
  clearTokenCache(); // Clear any cached QStash tokens from other test files
});

afterAll(() => {
  // Restore original config
  config.email = originalEmail;
  config.apiKey = originalApiKey;
  config.readonly = originalReadonly;
});

describe("readonly detection", () => {
  it("testConnection detects readonly API key", async () => {
    await testConnection();
    expect(config.readonly).toBe(true);
  });
});

describe("server tool filtering", () => {
  it("only registers readonly tools when config.readonly is true", () => {
    const allTools = { ...redisTools, ...qstashAllTools };
    const writeToolNames = Object.entries(allTools)
      .filter(([_, tool]) => !tool.readonly)
      .map(([name]) => name);

    const readonlyToolNames = Object.entries(allTools)
      .filter(([_, tool]) => tool.readonly)
      .map(([name]) => name);

    // Verify we have both categories defined
    expect(writeToolNames.length).toBeGreaterThan(0);
    expect(readonlyToolNames.length).toBeGreaterThan(0);

    // Verify specific write tools are correctly NOT marked readonly
    expect(writeToolNames).toContain("redis_database_create_new");
    expect(writeToolNames).toContain("redis_database_delete");
    expect(writeToolNames).toContain("redis_database_reset_password");
    expect(writeToolNames).toContain("qstash_publish_message");
    expect(writeToolNames).toContain("qstash_schedules_manage");

    // All QStash/workflow tools should be hidden in readonly mode (not supported yet)
    expect(writeToolNames).toContain("qstash_logs_list");
    expect(writeToolNames).toContain("qstash_schedules_list");
    expect(writeToolNames).toContain("workflow_logs_list");

    // Verify specific Redis read tools ARE marked readonly
    expect(readonlyToolNames).toContain("redis_database_list_databases");
    expect(readonlyToolNames).toContain("redis_database_get_details");
    expect(readonlyToolNames).toContain("redis_database_get_statistics");
    expect(readonlyToolNames).toContain("redis_database_run_redis_commands");
  });
});

describe("readonly redis read operations", () => {
  it("can list databases", async () => {
    const result = await redisTools.redis_database_list_databases.handler({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("can get database details", async () => {
    const dbs = await http.get<RedisDatabase[]>("v2/redis/databases");
    if (dbs.length === 0) return; // Skip if no databases

    const result = await redisTools.redis_database_get_details.handler({
      database_id: dbs[0].database_id,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain(dbs[0].database_name);
  });

  it("runs read-only redis commands using read_only_rest_token", async () => {
    const dbs = await http.get<RedisDatabase[]>("v2/redis/databases");
    if (dbs.length === 0) return; // Skip if no databases

    const result = await redisTools.redis_database_run_redis_commands.handler({
      database_id: dbs[0].database_id,
      commands: [["DBSIZE"]],
    });

    const text = Array.isArray(result) ? result.join("") : String(result);
    expect(text).toContain("result");
  });
});

describe("readonly redis write operations blocked", () => {
  it("rejects create database", async () => {
    expect(
      redisTools.redis_database_create_new.handler({
        name: "readonly-test-should-fail",
        primary_region: "us-east-1",
      })
    ).rejects.toThrow(/readonly api key/i);
  });

  it("rejects delete database", async () => {
    expect(
      redisTools.redis_database_delete.handler({
        database_id: "fake-id-should-not-matter",
      })
    ).rejects.toThrow(/readonly api key/i);
  });

  it("rejects reset password", async () => {
    expect(
      redisTools.redis_database_reset_password.handler({
        id: "fake-id-should-not-matter",
      })
    ).rejects.toThrow(/readonly api key/i);
  });
});

describe("readonly qstash operations", () => {
  it("qstash tools are not available in readonly mode", async () => {
    expect(
      qstashAllTools.qstash_schedules_list.handler({})
    ).rejects.toThrow("QStash is not available in readonly mode yet");
  });

  it("workflow tools are not available in readonly mode", async () => {
    expect(
      qstashAllTools.workflow_logs_list.handler({ count: 3 })
    ).rejects.toThrow("QStash is not available in readonly mode yet");
  });

  it("qstash tools are hidden from server in readonly mode", () => {
    const allQstashTools = Object.keys(qstashAllTools);
    for (const name of allQstashTools) {
      expect(qstashAllTools[name].readonly).toBeFalsy();
    }
  });
});
