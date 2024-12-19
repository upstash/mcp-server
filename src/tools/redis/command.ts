import { z } from "zod";
import { json, tool } from "..";

type RedisCommandResult =
  | {
      result: unknown;
    }
  | {
      error: string;
    };

export const redisCommandTools = {
  redis_database_run_single_redis_command: tool({
    description: `Run a single Redis command on a specific Upstash redis database.
NOTE: For discovery, use SCAN over KEYS. Use TYPE to get the type of a key.
NOTE: SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]`,
    inputSchema: z.object({
      database_rest_url: z
        .string()
        .describe("The REST URL of the database. Example: https://***.upstash.io"),
      database_rest_token: z.string().describe("The REST token of the database."),
      command: z
        .array(z.string())
        .describe("The Redis command to run. Example: ['SET', 'foo', 'bar', 'EX', 100]"),
    }),

    handler: async ({ database_rest_url, database_rest_token, command }) => {
      const req = await fetch(database_rest_url, {
        method: "POST",
        body: JSON.stringify(command),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${database_rest_token}`,
        },
      });

      const result = (await req.json()) as RedisCommandResult;

      if ("error" in result) {
        throw new Error("Redis error: " + result.error);
      }

      return json(result);
    },
  }),

  redis_database_run_multiple_redis_commands: tool({
    description: `Run multiple Redis commands on a specific Upstash redis database`,
    inputSchema: z.object({
      database_rest_url: z
        .string()
        .describe("The REST URL of the database. Example: https://***.upstash.io"),
      database_rest_token: z.string().describe("The REST token of the database."),
      commands: z
        .array(z.array(z.string()))
        .describe("The Redis commands to run. Example: [['SET', 'foo', 'bar'], ['GET', 'foo']]"),
    }),

    handler: async ({ database_rest_url, database_rest_token, commands }) => {
      const req = await fetch(database_rest_url, {
        method: "POST",
        body: JSON.stringify(commands),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${database_rest_token}`,
        },
      });

      const result = (await req.json()) as RedisCommandResult[];

      if (result.some((r) => "error" in r)) {
        throw new Error("Some commands in the pipeline resulted in an error:\n" + json(result));
      }

      return json(result);
    },
  }),
};
