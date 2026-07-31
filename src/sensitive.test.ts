#!/usr/bin/env bun

import { describe, it, expect } from "bun:test";
import { startRedisTools } from "./tools/redis/start-redis";

describe("sensitive tools", () => {
  it("marks the start-redis result as sensitive so the server never logs it", () => {
    expect(startRedisTools.redis_database_start_free.sensitive).toBe(true);
  });
});
