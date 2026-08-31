import { z } from "zod";
import { tool } from "../helpers";
import { getBoxClient } from "./utils";
type ExecResponse = { exit_code: number; output?: string; error?: string };

/**
 * Default bound for one command.
 *
 * The coordinator proxies a shell exec on a one-hour client, and this server
 * sets no timeout of its own, so without this a hung command would hold the
 * tool call for that whole hour.
 */
const DEFAULT_EXEC_TIMEOUT_MS = 600_000;

export const boxExecTool = {
  box_exec: tool({
    box: true,
    description: `Run a shell command inside an Upstash Box container. Runs in the box, not on your local machine — your own Bash tool runs on the user's machine and cannot see the box's files.

Prefer the purpose-built tools where they fit: box_read / box_write / box_edit for files, box_git for git (including search via git grep / git ls-files). Use this for everything else — package installs, builds, test runs, arbitrary commands.

Each call is a fresh shell, so 'cd' and environment variables do NOT carry over to the next call; pass 'folder' instead. To start something that outlives the command, detach it with '( cmd & )' and expose a server port with box_preview.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box ID to execute the command in"),
        command: z
          .array(z.string())
          .describe("Command and arguments as an array (e.g. ['bash', '-c', 'ls -la'])"),
        folder: z.string().optional().describe("Working directory inside the box"),
        timeout_ms: z
          .number()
          .int()
          .min(1000)
          .optional()
          .describe(
            `Stop waiting after this many milliseconds (default ${DEFAULT_EXEC_TIMEOUT_MS}). This abandons the HTTP request only — the command keeps running inside the box, so retrying a timed-out command can leave two copies running`
          ),
      });
    },
    handler: async (params) => {
      const { box_id, command, folder, timeout_ms } = params;
      const client = getBoxClient();

      const body: Record<string, unknown> = { command };
      if (folder) body.folder = folder;

      const response = await client.post<ExecResponse>(`v2/box/${box_id}/exec`, body, undefined, {
        timeoutMs: timeout_ms ?? DEFAULT_EXEC_TIMEOUT_MS,
      });

      if (response.exit_code !== 0) {
        return [
          `Command failed with exit code ${response.exit_code}`,
          response.output ? `stdout: ${response.output}` : "",
          response.error ? `stderr: ${response.error}` : "",
        ].filter(Boolean);
      }

      return [
        `Command executed successfully (exit code: ${response.exit_code})`,
        response.output || "(no output)",
      ];
    },
  }),
};
