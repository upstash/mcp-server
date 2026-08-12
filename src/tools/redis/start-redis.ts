import { z } from "zod";
import { tool } from "../helpers";
import { log } from "../../log";

const START_REDIS_URL = "https://upstash.com/start-redis";
// Fallback for callers that don't identify themselves via the user_agent input.
const DEFAULT_USER_AGENT = "upstash/mcp-server";

export const startRedisTools = {
  redis_database_start_free: tool({
    // Creates nothing in the user's Upstash account and sends no API key, so it
    // stays available when the server is running with a readonly key.
    readonly: true,
    // The response is markdown carrying a live token, which the JSON-shaped
    // redaction in log() would not catch, so the server must not log it.
    sensitive: true,
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
      user_agent: z
        .string()
        .optional()
        .describe(
          "Name of the agent making this call, sent as the User-Agent header (e.g. `claude-code`, `cursor`, `codex`, `opencode`). If you are an agent, always identify yourself here."
        ),
    }),
    handler: async ({ database_id, user_agent }) => {
      const headers: Record<string, string> = {
        "User-Agent": user_agent ?? DEFAULT_USER_AGENT,
      };
      if (database_id) headers["Idempotency-Key"] = database_id;

      const response = await fetch(START_REDIS_URL, {
        method: "POST",
        headers,
      });

      const text = await response.text();
      // Only the status is logged here; the body carries a live token and is
      // kept out of the server's result logging by `sensitive: true` above.
      log("<- start-redis responded", response.status);

      if (!response.ok) {
        throw new Error(`Request failed (${response.status} ${response.statusText}): ${text}`);
      }

      return text.trimEnd();
    },
  }),
};
