import { z } from "zod";
import { tool } from ".";

export const utilTools = {
  util_timestamps_to_date: tool({
    description: `Use this tool to convert a timestamp to a human-readable date`,
    inputSchema: z.object({
      timestamps: z.array(z.number()).describe("Array of timestamps to convert"),
    }),
    handler: async ({ timestamps }) => {
      return timestamps.map((timestamp) => new Date(timestamp).toUTCString());
    },
  }),
  util_dates_to_timestamps: tool({
    description: `Use this tool to convert an array of ISO 8601 dates to an array of timestamps`,
    inputSchema: z.object({
      dates: z.array(z.string()).describe("Array of dates to convert"),
    }),
    handler: async ({ dates }) => {
      return dates.map((date) => new Date(date).getTime()).join(",");
    },
  }),
};
