import { z } from "zod";
import { tool } from "../helpers";
import { buildBoxCommon } from "./common";
import { getBoxClient } from "./utils";
type ExecResponse = { exit_code: number; output?: string; error?: string };

export const boxExecTool = {
  box_exec: tool({
    description: `Execute a shell command inside an Upstash Box container. Use this for file operations, git commands, package installs, or any shell operation inside the box.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box ID to execute the command in"),
        command: z
          .array(z.string())
          .describe("Command and arguments as an array (e.g. ['bash', '-c', 'ls -la'])"),
        folder: z.string().optional().describe("Working directory inside the box"),
        async: z
          .boolean()
          .optional()
          .describe("If true, return immediately without waiting for completion"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, command, folder, async: isAsync } = params;
      const client = getBoxClient(params);

      const body: Record<string, unknown> = { command };
      if (folder) body.folder = folder;
      if (isAsync) body.async = isAsync;

      const response = await client.post<ExecResponse>(`v2/box/${box_id}/exec`, body);

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
