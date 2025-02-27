import { z } from "zod";
import { json, tool } from "..";
import { log } from "../../log";
import fetch from "node-fetch";

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

      log("command result:", result);

      if ("error" in result) {
        throw new Error("Redis error: " + result.error);
      }

      const isScanCommand = command[0].toLocaleLowerCase().includes("scan");
      const messages = [json(result)];

      if (isScanCommand)
        messages.push(`NOTE: Use the returned cursor to get the next set of keys.
NOTE: The result might be too large to be returned. If applicable, stop after the second SCAN command and ask the user if they want to continue.`);

      return messages;
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
      const req = await fetch(database_rest_url + "/pipeline", {
        method: "POST",
        body: JSON.stringify(commands),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${database_rest_token}`,
        },
      });

      const result = (await req.json()) as RedisCommandResult[];

      log("commands result:", result);

      if (result.some((r) => "error" in r)) {
        throw new Error("Some commands in the pipeline resulted in an error:\n" + json(result));
      }

      return json(result);
    },
  }),
};
