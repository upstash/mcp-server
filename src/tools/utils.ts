import { z } from "zod";
import { tool } from ".";

export const utilTools = {
  timestamps_to_date: tool({
    description: `Use this tool to convert a timestamp to a human-readable date`,
    inputSchema: z.object({
      timestamps: z.array(z.number()).describe("Array of timestamps to convert"),
    }),
    handler: async ({ timestamps }) => {
      return timestamps.map((timestamp) => new Date(timestamp).toUTCString());
    },
  }),
}