import { z } from "zod";
import { json, tool } from "../helpers";
import { buildBoxCommon } from "./common";
import { getBoxClient } from "./utils";

export const boxLogsTool = {
  box_logs: tool({
    description: `Get logs from an Upstash Box container. Useful for debugging what happened inside the box. Returns timestamped log entries from the system, user, and agent sources.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box ID to get logs for"),
        offset: z
          .number()
          .optional()
          .default(0)
          .describe("Starting position for log entries (default: 0)"),
        limit: z
          .number()
          .max(1000)
          .optional()
          .default(100)
          .describe("Maximum number of log entries to return (max 1000, default: 100)"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, offset, limit } = params;
      const client = getBoxClient(params);

      const response = await client.get<{ logs: unknown[] }>(`v2/box/${box_id}/logs`, {
        offset,
        limit,
      });

      const logs = response.logs ?? [];
      if (logs.length === 0) {
        return "No logs found for this box";
      }

      return [`Found ${logs.length} log entries`, json(logs)];
    },
  }),
};
