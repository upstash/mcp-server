import { z } from "zod";
import { json, tool } from "..";
import { http } from "../../http";
import type { RedisDatabase, RedisUsageResponse, UsageData } from "./types";
import { pruneFalsy } from "../../utils";

const readRegionSchema = z.union([
  z.literal("us-east-1"),
  z.literal("us-west-1"),
  z.literal("us-west-2"),
  z.literal("eu-west-1"),
  z.literal("eu-central-1"),
  z.literal("ap-southeast-1"),
  z.literal("ap-southeast-2"),
  z.literal("sa-east-1"),
]);

const GENERIC_DATABASE_NOTES =
  "\nNOTE: Don't show the database ID from the response to the user unless explicitly asked or needed.\n";

export const redisDbOpsTools = {
  redis_database_create_new: tool({
    description: `Create a new Upstash redis database. 
NOTE: Ask user for the region and name of the database.${GENERIC_DATABASE_NOTES}`,
    inputSchema: z.object({
      name: z.string().describe("Name of the database."),
      primary_region: readRegionSchema.describe(`Primary Region of the Global Database.`),
      read_regions: z
        .array(readRegionSchema)
        .optional()
        .describe(`Array of read regions of the db`),
    }),
    handler: async ({ name, primary_region, read_regions }) => {
      const newDb = await http.post<RedisDatabase>("v2/redis/database", {
        name,
        region: "global",
        primary_region,
        read_regions,
      });

      return [
        json(newDb),
        `Upstash console url: https://console.upstash.com/redis/${newDb.database_id}`,
      ];
    },
  }),

  redis_database_delete: tool({
    description: `Delete an Upstash redis database.`,
    inputSchema: z.object({
      database_id: z.string().describe("The ID of the database to delete."),
    }),
    handler: async ({ database_id }) => {
      await http.delete(["v2/redis/database", database_id]);

      return "Database deleted successfully.";
    },
  }),

  redis_database_list_databases: tool({
    description: `List all Upstash redis databases. Only their names and ids.${GENERIC_DATABASE_NOTES}`,
    handler: async () => {
      const dbs = await http.get<RedisDatabase[]>("v2/redis/databases");

      const messages = [
        json(
          dbs.map((db) => {
            const result = {
              database_id: db.database_id,
              database_name: db.database_name,
              state: db.state === "active" ? undefined : db.state,
            };
            return pruneFalsy(result);
          })
        ),
      ];

      if (dbs.length > 2)
        messages.push(
          `If the user did not specify a database name for the next command, ask them to choose a database from the list`
        );

      return messages;
    },
  }),

  redis_database_get_details: tool({
    description: `Get further details of a specific Upstash redis database. Includes all details of the database including usage statistics.
db_disk_threshold: Total disk usage limit.
db_memory_threshold: Maximum memory usage.
db_daily_bandwidth_limit: Maximum daily network bandwidth usage.
db_request_limit: Total number of commands allowed.
All sizes are in bytes
${GENERIC_DATABASE_NOTES}
      `,
    inputSchema: z.object({
      database_id: z.string().describe("The ID of the database to get details for."),
    }),
    handler: async ({ database_id }) => {
      const db = await http.get<RedisDatabase>(["v2/redis/database", database_id]);

      return json(db);
    },
  }),

  redis_database_update_regions: tool({
    description: `Update the read regions of an Upstash redis database.`,
    inputSchema: z.object({
      id: z.string().describe("The ID of your database."),
      read_regions: z
        .array(readRegionSchema)
        .describe(
          "Array of the new read regions of the database. This will replace the old regions array. Available regions: us-east-1, us-west-1, us-west-2, eu-west-1, eu-central-1, ap-southeast-1, ap-southeast-2, sa-east-1"
        ),
    }),
    handler: async ({ id, read_regions }) => {
      const updatedDb = await http.post<RedisDatabase>(["v2/redis/update-regions", id], {
        read_regions,
      });

      return json(updatedDb);
    },
  }),

  redis_database_reset_password: tool({
    description: `Reset the password of an Upstash redis database.`,
    inputSchema: z.object({
      id: z.string().describe("The ID of your database."),
    }),
    handler: async ({ id }) => {
      const updatedDb = await http.post<RedisDatabase>(["v2/redis/reset-password", id], {});

      return json(updatedDb);
    },
  }),

  redis_database_get_last_5_days_usage: tool({
    description: `Get PRECISE command count and bandwidth usage statistics of an Upstash redis database over the last 5 days (calculated according to UTC+0). This is a precise stat, not an average.
NOTE: Mention that times are in UTC+0 in the response
NOTE: Ask user first if they want to see stats for each database seperately or just for one`,
    inputSchema: z.object({
      id: z.string().describe("The ID of your database."),
    }),
    handler: async ({ id }) => {
      const stats = await http.get<RedisUsageResponse>(["v2/redis/stats", `${id}?period=3h`]);

      return json({
        days: stats.days,
        command_usage: stats.dailyrequests,
        bandwidth_usage: stats.bandwidths,
      });
    },
  }),

  redis_database_get_usage_stats: tool({
    description: `Get SAMPLED usage statistics of an Upstash redis database over a period of time (1h, 3h, 12h, 1d, 3d, 7d). Use this to check for peak usages and latency problems.
Includes: read_latency_mean, write_latency_mean, keyspace, throughput (cmds/sec), diskusage`,
    inputSchema: z.object({
      id: z.string().describe("The ID of your database."),
      period: z
        .union([
          z.literal("1h"),
          z.literal("3h"),
          z.literal("12h"),
          z.literal("1d"),
          z.literal("3d"),
          z.literal("7d"),
        ])
        .describe("The period of the stats."),
      type: z
        .union([
          z.literal("read_latency_mean"),
          z.literal("write_latency_mean"),
          z.literal("keyspace").describe("Number of keys in db"),
          z
            .literal("throughput")
            .describe("commands per second (sampled), calculate area for estimated count"),
          z.literal("diskusage").describe("Current disk usage in bytes"),
        ])
        .describe("The type of stat to get"),
    }),
    handler: async ({ id, period, type }) => {
      const stats = await http.get<RedisUsageResponse>([
        "v2/redis/stats",
        `${id}?period=${period}`,
      ]);

      const stat = stats[type];

      if (Array.isArray(stat)) {
        return JSON.stringify(parseUsageData(stat));
      }

      return [json(stats), `NOTE: Use the timestamps_to_date tool to parse timestamps if needed`];
    },
  }),
};

const parseUsageData = (data: UsageData) => {
  if (!data) return "NO DATA";
  if (!Array.isArray(data)) return "INVALID DATA";
  if (data.length === 0 || data.length === 1) return "NO DATA";
  const filteredData = data.filter((d) => d.x && d.y);
  return {
    start: filteredData[0].x,
    // last one can be null, so use the second last
    // eslint-disable-next-line unicorn/prefer-at
    end: filteredData[filteredData.length - 1]?.x,
    data: data.map((d) => [new Date(d.x).getTime(), d.y]),
  };
};
