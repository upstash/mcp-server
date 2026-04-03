import { z } from "zod";
import { json, tool } from "../helpers";
import { boxCommon } from "./common";
import { getBoxClient } from "./utils";
import type { BoxRun } from "./types";

export const boxRunsTool = {
  box_runs: tool({
    description: `List, get details, or cancel runs (execution history) for an Upstash Box. Useful for debugging past agent runs and shell executions, checking their status, output, token usage, and costs.`,
    inputSchema: z.object({
      action: z
        .enum(["list", "get", "cancel"])
        .describe("The action to perform"),
      box_id: z.string().describe("The box ID"),
      run_id: z
        .string()
        .optional()
        .describe("Run ID (required for get and cancel actions)"),
      ...boxCommon,
    }),
    handler: async (params) => {
      const { action, box_id, run_id } = params;
      const client = getBoxClient(params);

      switch (action) {
        case "list": {
          const response = await client.get<{ runs: BoxRun[] }>(`v2/box/${box_id}/runs`);
          const runs = response.runs ?? [];
          return [
            `Found ${runs.length} runs`,
            json(runs),
          ];
        }

        case "get": {
          if (!run_id) throw new Error("run_id is required for get action");
          const run = await client.get<BoxRun>(`v2/box/${box_id}/runs/${run_id}`);
          return [
            `Run ${run_id} (status: ${run.status})`,
            json(run),
          ];
        }

        case "cancel": {
          if (!run_id) throw new Error("run_id is required for cancel action");
          await client.post(`v2/box/${box_id}/runs/${run_id}/cancel`);
          return `Run ${run_id} cancelled successfully`;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  }),
};
