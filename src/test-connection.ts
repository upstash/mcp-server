import { http } from "./http";
import { log } from "./log";
import type { RedisDatabase } from "./tools/redis/types";

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

  log("✅ Connection to Upstash API is successful");
}
