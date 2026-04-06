import { config } from "./config";
import { http } from "./http";
import { log } from "./log";
import type { RedisDatabase } from "./tools/redis/types";

const READONLY_ERROR = "Readonly API key";

export async function testConnection() {
  log("🧪 Testing connection to Upstash API");

  let dbs: RedisDatabase[] | undefined;
  try {
    dbs = await http.get<RedisDatabase[]>("v2/redis/databases");
  } catch (error) {
    log(
      "❌ Connection to Upstash API failed. Please check your api key and email. Error: ",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }

  if (!Array.isArray(dbs))
    throw new Error("Invalid response from Upstash API. Check your API key and email.");

  // Detect readonly API key by attempting a write operation with a fake ID
  try {
    await http.delete("v2/redis/database/readonly-check-nonexistent");
  } catch (error) {
    if (error instanceof Error && error.message.includes(READONLY_ERROR)) {
      config.readonly = true;
      log("🔒 Readonly API key detected. Write operations will be disabled.");
    }
    // "database not found" error is expected for non-readonly keys — ignore it
  }

  log("✅ Connection to Upstash API is successful");
}
