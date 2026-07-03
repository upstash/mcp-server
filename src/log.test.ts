#!/usr/bin/env bun

import { describe, it, expect } from "bun:test";
import { redactLogArgs, REDACTED } from "./log";

// Realistic samples mirroring what leaked into CI logs. Values are fake but
// shaped like the real ones (QStash tokens are `eyJ...` JWTs).
const FAKE_QSTASH_TOKEN = "eyJVc2VySUQiOiI5OTa4c327FAKEtokenVALUE0123456789";
const FAKE_QSTASH_RO_TOKEN = "eyJVc2VySUQiOiI5OTreadONLYfakeVALUE9876543210";
const FAKE_REST_TOKEN = "ggAAAAAAAV5RAAIgFAKErestTOKENvalue00000";
const FAKE_RO_REST_TOKEN = "ggAAAAAAAV5RAAIgFAKEreadonlyRESTtoken111";
const FAKE_PASSWORD = "ffffffffffffffffffffffffffffffff";

describe("redactLogArgs — object args", () => {
  it("redacts the v2/qstash/users response shape (token + read_only_token) across regions", () => {
    const users = [
      { region: "eu-central-1", token: FAKE_QSTASH_TOKEN, read_only_token: FAKE_QSTASH_RO_TOKEN },
      { region: "us-east-1", token: FAKE_QSTASH_TOKEN, read_only_token: FAKE_QSTASH_RO_TOKEN },
    ];
    const out = redactLogArgs(["<- received response", users]);

    expect(out).not.toContain(FAKE_QSTASH_TOKEN);
    expect(out).not.toContain(FAKE_QSTASH_RO_TOKEN);
    expect(out).toContain(REDACTED);
    // Non-sensitive fields are preserved.
    expect(out).toContain("eu-central-1");
    expect(out).toContain("us-east-1");
  });

  it("redacts Redis database secrets (rest_token, read_only_rest_token, password) but keeps the endpoint", () => {
    const db = {
      database_id: "252e5780-1cd3-4763-8e8b-099dc4fd1c2e",
      endpoint: "clean-crab-89681.upstash.io",
      password: FAKE_PASSWORD,
      rest_token: FAKE_REST_TOKEN,
      read_only_rest_token: FAKE_RO_REST_TOKEN,
    };
    const out = redactLogArgs([db]);

    expect(out).not.toContain(FAKE_PASSWORD);
    expect(out).not.toContain(FAKE_REST_TOKEN);
    expect(out).not.toContain(FAKE_RO_REST_TOKEN);
    expect(out).toContain("clean-crab-89681.upstash.io");
    expect(out).toContain("252e5780-1cd3-4763-8e8b-099dc4fd1c2e");
  });

  it("redacts an Authorization header regardless of casing", () => {
    const req = {
      url: "https://api.upstash.com/v2/redis/databases",
      Authorization: "Basic c2VjcmV0",
    };
    const out = redactLogArgs(["-> sending request", req]);
    expect(out).not.toContain("c2VjcmV0");
    expect(out).toContain(REDACTED);
  });

  it("redacts secrets nested deep inside objects and arrays", () => {
    const nested = { a: { b: [{ c: { token: FAKE_QSTASH_TOKEN } }] } };
    const out = redactLogArgs([nested]);
    expect(out).not.toContain(FAKE_QSTASH_TOKEN);
    expect(out).toContain(REDACTED);
  });
});

describe("redactLogArgs — already-stringified args", () => {
  // http.ts logs `json(result)` — a string, not an object — so redaction must
  // also mask secrets inside a JSON string.
  it("redacts tokens inside a pre-serialized JSON string", () => {
    const serialized = JSON.stringify(
      [{ region: "eu-central-1", token: FAKE_QSTASH_TOKEN, read_only_token: FAKE_QSTASH_RO_TOKEN }],
      null,
      2
    );
    const out = redactLogArgs(["<- received response", serialized]);

    expect(out).not.toContain(FAKE_QSTASH_TOKEN);
    expect(out).not.toContain(FAKE_QSTASH_RO_TOKEN);
    expect(out).toContain(REDACTED);
    expect(out).toContain("eu-central-1");
  });

  it("redacts a pretty-printed Redis rest_token in a JSON string", () => {
    const serialized = JSON.stringify(
      { endpoint: "clean-crab-89681.upstash.io", rest_token: FAKE_REST_TOKEN },
      null,
      2
    );
    const out = redactLogArgs([serialized]);
    expect(out).not.toContain(FAKE_REST_TOKEN);
    expect(out).toContain("clean-crab-89681.upstash.io");
  });
});

describe("redactLogArgs — non-sensitive input is untouched", () => {
  it("leaves plain strings and safe fields intact", () => {
    const out = redactLogArgs(["Fetching database details for database_id:", "252e5780"]);
    expect(out).toBe("Fetching database details for database_id: 252e5780");
    expect(out).not.toContain(REDACTED);
  });
});
