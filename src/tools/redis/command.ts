import { z } from "zod";
import { json, tool } from "..";
import { log } from "../../log";
import { http } from "../../http";
import type { RedisDatabase } from "./types";
import fetch from "node-fetch";

type RedisCommandResult =
  | {
      result: unknown;
    }
  | {
      error: string;
    };

export const redisCommandTools = {
  redis_database_run_redis_commands: tool({
    description: `Run one or more Redis commands on a specific Upstash redis database. Either provide database_id OR both database_rest_url and database_rest_token.
NOTE: For discovery, use SCAN over KEYS. Use TYPE to get the type of a key.
NOTE: SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]
NOTE: Multiple commands will be executed as a pipeline for better performance.`,
    inputSchema: z
      .object({
        database_id: z.string().optional().describe("The ID of the database to run commands on."),
        database_rest_url: z
          .string()
          .optional()
          .describe("The REST URL of the database. Example: https://***.upstash.io"),
        database_rest_token: z.string().optional().describe("The REST token of the database."),
        commands: z
          .array(z.array(z.string()))
          .describe(
            "The Redis commands to run. For single command: [['SET', 'foo', 'bar']], for multiple: [['SET', 'foo', 'bar'], ['GET', 'foo']]"
          ),
      })
      .refine(
        (data) => {
          // Either database_id OR (database_rest_url AND database_rest_token) must be provided
          return data.database_id || (data.database_rest_url && data.database_rest_token);
        },
        {
          message: "Either provide database_id OR both database_rest_url and database_rest_token",
        }
      ),

    handler: async ({ database_id, database_rest_url, database_rest_token, commands }) => {
      if (database_id && (database_rest_url || database_rest_token)) {
        throw new Error(
          "Either provide database_id OR both database_rest_url and database_rest_token"
        );
      }

      let restUrl = database_rest_url;
      let restToken = database_rest_token;

      // If only database_id is provided, fetch the database details
      if (database_id && (!database_rest_url || !database_rest_token)) {
        log("Fetching database details for database_id:", database_id);
        const db = await http.get<RedisDatabase>(["v2/redis/database", database_id]);
        restUrl = db.endpoint;
        restToken = db.rest_token;
      }

      if (!restUrl || !restToken) {
        throw new Error("Could not determine REST URL and token for the database");
      }
      const isSingleCommand = commands.length === 1;
      const url = isSingleCommand ? restUrl : restUrl + "/pipeline";
      const body = isSingleCommand ? JSON.stringify(commands[0]) : JSON.stringify(commands);

      const req = await fetch(url, {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${restToken}`,
        },
      });

      if (isSingleCommand) {
        const result = (await req.json()) as RedisCommandResult;

        log("command result:", result);

        if ("error" in result) {
          throw new Error("Redis error: " + result.error);
        }

        const isScanCommand = commands[0][0].toLocaleLowerCase().includes("scan");
        const messages = [json(result)];

        if (isScanCommand)
          messages.push(`NOTE: Use the returned cursor to get the next set of keys.
NOTE: The result might be too large to be returned. If applicable, stop after the second SCAN command and ask the user if they want to continue.`);

        return messages;
      } else {
        const result = (await req.json()) as RedisCommandResult[];

        log("commands result:", result);

        if (result.some((r) => "error" in r)) {
          throw new Error("Some commands in the pipeline resulted in an error:\n" + json(result));
        }

        return json(result);
      }
    },
  }),
};
