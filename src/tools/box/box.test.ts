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
import { boxFilesTool } from "./files";
import { boxGitTool } from "./git";
import { config } from "../../config";

const tools = {
  ...boxManageTool,
  ...boxExecTool,
  ...boxAgentRunTool,
  ...boxLogsTool,
  ...boxRunsTool,
  ...boxPreviewTool,
  ...boxSnapshotsTool,
  ...boxFilesTool,
  ...boxGitTool,
} as Record<string, CustomTool<any>>;

const E2E_PREFIX = "mcp-e2e-";

/** Tool handlers return a string or a list of lines; flatten for assertions. */
const text = (result: unknown) => (Array.isArray(result) ? result.join("\n") : String(result));
let createdBoxId: string;
let createdSnapshotId: string;
let agentRunId: string;

beforeAll(() => {
  const key = process.env.UPSTASH_BOX_API_KEY;
  if (!key) {
    throw new Error("UPSTASH_BOX_API_KEY must be set in .env file");
  }
  config.boxApiKey = key;
});

// Box provisions snapshots asynchronously; deleting one while it is still being
// created returns 409 ("Snapshot is still being created"). Poll the box's
// snapshot list until ours leaves the "creating" state before deleting.
async function waitForSnapshotReady(
  boxId: string,
  snapshotId: string,
  { timeoutMs = 60_000, intervalMs = 2000 } = {}
): Promise<string> {
  const start = Date.now();
  let lastStatus = "unknown";
  while (Date.now() - start < timeoutMs) {
    const result = await tools.box_snapshots.handler({
      action: "list",
      box_id: boxId,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    const jsonPart = text.slice(text.indexOf("\n") + 1).trim();
    let snapshots: Array<{ id: string; status: string }> = [];
    try {
      snapshots = JSON.parse(jsonPart);
    } catch {
      // transient/unparseable response — retry
    }
    const snap = snapshots.find((s) => s.id === snapshotId);
    if (snap) {
      lastStatus = snap.status;
      if (snap.status !== "creating") {
        return snap.status;
      }
    }
    await Bun.sleep(intervalMs);
  }
  throw new Error(
    `Snapshot ${snapshotId} did not become ready within ${timeoutMs}ms (last status: ${lastStatus})`
  );
}

afterAll(async () => {
  // Cleanup: delete any boxes with the e2e prefix that might be lingering
  try {
    const result = await tools.box_manage.handler({
      action: "list",
    });
    const listText = Array.isArray(result) ? result.join("") : String(result);
    const parsed = JSON.parse(listText.replace(/^Found \d+ boxes/, "").trim() || "[]");
    if (Array.isArray(parsed)) {
      for (const box of parsed) {
        if (box.name?.startsWith(E2E_PREFIX)) {
          try {
            await tools.box_manage.handler({
              action: "delete",
              box_id: box.id,
            });
            // eslint-disable-next-line no-console
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
      });
      // eslint-disable-next-line no-console
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
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ boxes/);
  });

  it("gets a box by id", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_manage.handler({
      action: "get",
      box_id: createdBoxId,
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
      });
      const listText = Array.isArray(listResult) ? listResult.join("") : String(listResult);
      const runsJson = listText.replace(/^Found \d+ runs/, "").trim();
      const runs = JSON.parse(runsJson || "[]");
      if (runs.length === 0) {
        // eslint-disable-next-line no-console
        console.log("No runs available to test get — skipping");
        return;
      }
      runId = runs[0].id;
    }

    const result = await tools.box_runs.handler({
      action: "get",
      box_id: createdBoxId,
      run_id: runId,
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
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ snapshots/);
  });

  it("lists all snapshots", async () => {
    const result = await tools.box_snapshots.handler({
      action: "list_all",
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toMatch(/Found \d+ snapshots total/);
  });

  it("deletes the snapshot", async () => {
    expect(createdBoxId).toBeDefined();
    expect(createdSnapshotId).toBeDefined();
    // Wait until Box finishes creating the snapshot, else delete returns 409.
    await waitForSnapshotReady(createdBoxId, createdSnapshotId);
    const result = await tools.box_snapshots.handler({
      action: "delete",
      box_id: createdBoxId,
      snapshot_id: createdSnapshotId,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("deleted successfully");
    // Mark as cleaned up so afterAll doesn't try again
    createdSnapshotId = "";
  }, 90_000);
});

describe("box files", () => {
  it("writes and reads a file back exactly", async () => {
    await tools.box_write.handler({
      box_id: createdBoxId,
      path: "e2e/note.txt",
      content: "alpha\nbeta\n",
    });
    const read = await tools.box_read.handler({
      box_id: createdBoxId,
      path: "e2e/note.txt",
    });
    expect(read).toBe("alpha\nbeta\n");
  });

  it("reads a bounded byte range", async () => {
    const read = await tools.box_read.handler({
      box_id: createdBoxId,
      path: "e2e/note.txt",
      offset: 0,
      length: 5,
    });
    expect(read).toBe("alpha");
  });

  it("lists the directory it was given, not the workspace root", async () => {
    const listed = text(await tools.box_list_files.handler({ box_id: createdBoxId, path: "e2e" }));
    expect(listed).toContain("note.txt");
  });

  it("edits an exact match and refuses an ambiguous one", async () => {
    await tools.box_edit.handler({
      box_id: createdBoxId,
      path: "e2e/note.txt",
      old_string: "beta",
      new_string: "BETA",
    });
    expect(
      await tools.box_read.handler({
        box_id: createdBoxId,
        path: "e2e/note.txt",
      })
    ).toBe("alpha\nBETA\n");

    await tools.box_write.handler({
      box_id: createdBoxId,
      path: "e2e/dup.txt",
      content: "x\nx\n",
    });
    await expect(
      tools.box_edit.handler({
        box_id: createdBoxId,
        path: "e2e/dup.txt",
        old_string: "x",
        new_string: "y",
      })
    ).rejects.toThrow(/appears 2 times/);
  });

  it("uploads a local file through multipart", async () => {
    const local = `/tmp/mcp-e2e-upload-${Date.now()}.txt`;
    await Bun.write(local, "uploaded from disk\n");
    await tools.box_upload.handler({
      box_id: createdBoxId,
      files: [{ local_path: local, destination: "e2e/uploaded.txt" }],
    });
    expect(
      await tools.box_read.handler({
        box_id: createdBoxId,
        path: "e2e/uploaded.txt",
      })
    ).toBe("uploaded from disk\n");
  });
});

describe("box git", () => {
  const repoFolder = "Hello-World";

  it("clones a repository", async () => {
    const result = text(
      await tools.box_git.handler({
        action: "clone",
        box_id: createdBoxId,
        repo: "https://github.com/octocat/Hello-World",
      })
    );
    expect(result).toContain("Cloned");
  });

  it("searches tracked files with git grep", async () => {
    const result = text(
      await tools.box_git.handler({
        action: "exec",
        box_id: createdBoxId,
        folder: repoFolder,
        args: ["grep", "-n", "Hello"],
      })
    );
    expect(result).toContain("README");
  });

  it("explains a git failure caused by a missing folder", async () => {
    const result = text(
      await tools.box_git.handler({
        action: "exec",
        box_id: createdBoxId,
        args: ["grep", "-n", "Hello"],
      })
    );
    expect(result).toContain("no 'folder' was given");
  });

  it("checks out a branch, commits, and reports status", async () => {
    await tools.box_git.handler({
      action: "checkout",
      box_id: createdBoxId,
      folder: repoFolder,
      branch: "e2e/mcp",
    });
    await tools.box_write.handler({
      box_id: createdBoxId,
      path: `${repoFolder}/e2e.md`,
      content: "e2e\n",
    });
    await tools.box_git.handler({
      action: "exec",
      box_id: createdBoxId,
      folder: repoFolder,
      args: ["add", "-A"],
    });
    const committed = text(
      await tools.box_git.handler({
        action: "commit",
        box_id: createdBoxId,
        folder: repoFolder,
        message: "e2e commit",
        author_name: "MCP E2E",
        author_email: "e2e@upstash.com",
      })
    );
    expect(committed).toContain("sha");

    const branch = text(
      await tools.box_git.handler({
        action: "exec",
        box_id: createdBoxId,
        folder: repoFolder,
        args: ["rev-parse", "--abbrev-ref", "HEAD"],
      })
    );
    expect(branch).toContain("e2e/mcp");

    const status = text(
      await tools.box_git.handler({
        action: "status",
        box_id: createdBoxId,
        folder: repoFolder,
      })
    );
    expect(status).toContain("status");
  });
});

describe("box_manage cleanup", () => {
  it("deletes the box", async () => {
    expect(createdBoxId).toBeDefined();
    const result = await tools.box_manage.handler({
      action: "delete",
      box_id: createdBoxId,
    });
    const text = Array.isArray(result) ? result.join("\n") : String(result);
    expect(text).toContain("deleted successfully");
  });
});
