#!/usr/bin/env bun

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import type { CustomTool } from "../../tool";
import { boxManageTool } from "./manage";
import { boxExecTool } from "./exec";
import { boxAgentRunTool } from "./agent-run";
import { boxLogsTool } from "./logs";
import { boxRunsTool } from "./runs";
import { boxPreviewTool } from "./preview";
import { boxSnapshotsTool } from "./snapshots";

const tools = {
  ...boxManageTool,
  ...boxExecTool,
  ...boxAgentRunTool,
  ...boxLogsTool,
  ...boxRunsTool,
  ...boxPreviewTool,
  ...boxSnapshotsTool,
} as Record<string, CustomTool<any>>;

const E2E_PREFIX = "mcp-e2e-";
let boxApiKey: string;
let createdBoxId: string;
let createdSnapshotId: string;
let agentRunId: string;

beforeAll(() => {
  const key = process.env.UPSTASH_BOX_API_KEY;
  if (!key) {
    throw new Error("UPSTASH_BOX_API_KEY must be set in .env file");
  }
  boxApiKey = key;
});

afterAll(async () => {
  // Cleanup: delete any boxes with the e2e prefix that might be lingering
  try {
    const result = await tools.box_manage.handler({
      action: "list",
      box_api_key: boxApiKey,
    });
    const listText = Array.isArray(result) ? result.join("") : String(result);
    const parsed = JSON.parse(
      listText.replace(/^Found \d+ boxes/, "").trim() || "[]"
    );
    if (Array.isArray(parsed)) {
      for (const box of parsed) {
        if (box.name?.startsWith(E2E_PREFIX)) {
          try {
            await tools.box_manage.handler({
              action: "delete",
              box_id: box.id,
              box_api_key: boxApiKey,
            });
            console.log(`Cleanup: deleted box ${box.id} (${box.name})`);
          } catch {
            // ignore cleanup errors
          }
        }
      }
    }
  } catch {
    // ignore cleanup errors
  }

  // Cleanup snapshots
  if (createdSnapshotId && createdBoxId) {
    try {
      await tools.box_snapshots.handler({
        action: "delete",
        box_id: createdBoxId,
        snapshot_id: createdSnapshotId,
        box_api_key: boxApiKey,
      });
      console.log(`Cleanup: deleted snapshot ${createdSnapshotId}`);
    } catch {
      // ignore
    }
  }
});

describe("box_manage", () => {
  it("creates a box", async () => {
    const result = await tools.box_manage.handler({
      action: "create",
      name: `${E2E_PREFIX}${Date.now()}`,
      model: "claude/sonnet_4_6",
      runtime: "node",
      ephemeral: true,
      ttl: 600,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("Box created successfully");
    expect(text).toContain("Box ID:");

    // Extract box ID
    const idMatch = text.match(/Box ID: ([\w-]+)/);
    expect(idMatch).not.toBeNull();
    createdBoxId = idMatch![1];
  }, 30_000);

  it("lists boxes", async () => {
    const result = await tools.box_manage.handler({
      action: "list",
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ boxes/);
  });

  it("gets a box by id", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_manage.handler({
      action: "get",
      box_id: createdBoxId,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain(createdBoxId);
  });

  // Note: pause/resume/fork are not tested here because the test uses ephemeral boxes
  // which don't support these actions. They work on non-ephemeral boxes.
});

describe("box_exec", () => {
  it("executes a shell command", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_exec.handler({
      box_id: createdBoxId,
      command: ["echo", "hello from mcp e2e"],
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("hello from mcp e2e");
  }, 30_000);
});

describe("box_agent_run", () => {
  it("runs an agent prompt", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_agent_run.handler({
      box_id: createdBoxId,
      prompt: "Echo 'agent-test-ok' to stdout using a shell command, nothing else.",
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("Agent run completed");

    // Extract run ID for later tests
    const runIdMatch = text.match(/Run ID: ([\w-]+)/);
    if (runIdMatch) {
      agentRunId = runIdMatch[1];
    }
  }, 120_000);
});

describe("box_logs", () => {
  it("gets box logs", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_logs.handler({
      box_id: createdBoxId,
      limit: 10,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    // Might have logs or might be empty for a fresh box
    expect(text).toMatch(/Found \d+ log entries|No logs found/);
  });
});

describe("box_runs", () => {
  it("lists runs", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_runs.handler({
      action: "list",
      box_id: createdBoxId,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ runs/);
  });

  it("gets a run by id", async () => {
    expect(createdBoxId).toBeDefined();
    // If we have a run ID from the agent test, use it; otherwise list runs first
    let runId = agentRunId;
    if (!runId) {
      const listResult = await tools.box_runs.handler({
        action: "list",
        box_id: createdBoxId,
        box_api_key: boxApiKey,
      });
      const listText = Array.isArray(listResult) ? listResult.join("") : String(listResult);
      const runsJson = listText.replace(/^Found \d+ runs/, "").trim();
      const runs = JSON.parse(runsJson || "[]");
      if (runs.length === 0) {
        console.log("No runs available to test get — skipping");
        return;
      }
      runId = runs[0].id;
    }

    const result = await tools.box_runs.handler({
      action: "get",
      box_id: createdBoxId,
      run_id: runId,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain(runId);
  });
});

describe("box_preview", () => {
  it("lists previews (initially empty)", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_preview.handler({
      action: "list",
      box_id: createdBoxId,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ preview URLs/);
  });

  it("creates a preview URL", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_preview.handler({
      action: "create",
      box_id: createdBoxId,
      port: 3000,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("Preview URL created:");
    expect(text).toContain("Port: 3000");
  });

  it("deletes the preview URL", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_preview.handler({
      action: "delete",
      box_id: createdBoxId,
      port: 3000,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("deleted successfully");
  });
});

describe("box_snapshots", () => {
  it("creates a snapshot", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_snapshots.handler({
      action: "create",
      box_id: createdBoxId,
      name: `${E2E_PREFIX}snapshot-${Date.now()}`,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("Snapshot created");
    expect(text).toContain("Snapshot ID:");

    const idMatch = text.match(/Snapshot ID: ([\w-]+)/);
    expect(idMatch).not.toBeNull();
    createdSnapshotId = idMatch![1];
  }, 30_000);

  it("lists snapshots for the box", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_snapshots.handler({
      action: "list",
      box_id: createdBoxId,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ snapshots/);
  });

  it("lists all snapshots", async () => {
    const result = await tools.box_snapshots.handler({
      action: "list_all",
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ snapshots total/);
  });

  it("deletes the snapshot", async () => {
    expect(createdBoxId).toBeDefined();
    expect(createdSnapshotId).toBeDefined();
    const result = await tools.box_snapshots.handler({
      action: "delete",
      box_id: createdBoxId,
      snapshot_id: createdSnapshotId,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("deleted successfully");
    // Mark as cleaned up so afterAll doesn't try again
    createdSnapshotId = "";
  });
});

describe("box_manage cleanup", () => {
  it("deletes the box", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_manage.handler({
      action: "delete",
      box_id: createdBoxId,
      box_api_key: boxApiKey,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("deleted successfully");
  });
});
