import { z } from "zod";
import { tool } from "../helpers";
import { log } from "../../log";

const START_REDIS_URL = "https://upstash.com/start-redis";

export const startRedisTools = {
  redis_database_start_free: tool({
    // Creates nothing in the user's Upstash account and sends no API key, so it
    // stays available when the server is running with a readonly key.
    readonly: true,
    description: `Get a free temporary Upstash redis database without an Upstash account or API key. Use this when YOU need a redis database to use or experiment with, instead of redis_database_create_new which creates one in the user's account.
The response is markdown containing the endpoint, token, a console URL the user can use to claim the database, and a quickstart.
NOTE: The database expires in 72 hours. If the user wants to keep it, share the console URL from the response with them so they can claim it.
NOTE: Don't store sensitive data in it — it is temporary and not tied to an account until claimed.`,
    inputSchema: z.object({
      database_id: z
        .string()
        .optional()
        .describe(
          "ID of a database started earlier. Pass it to re-fetch that database's credentials instead of starting a new one."
        ),
    }),
    handler: async ({ database_id }) => {
      const response = await fetch(START_REDIS_URL, {
        method: "POST",
        headers: database_id ? { "Idempotency-Key": database_id } : undefined,
      });

      const text = await response.text();
      // The body carries a live token, so only the status is logged.
      log("<- start-redis responded", response.status);

      if (!response.ok) {
        throw new Error(`Request failed (${response.status} ${response.statusText}): ${text}`);
      }

      return text.trimEnd();
    },
  }),
};
