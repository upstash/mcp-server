import { http } from "./http";
import { log } from "./log";

export async function testConnection() {
  log("🧪 Testing connection to Upstash API");
  // TODO: Test the connection to the Upstash API here
  // to check if the token is valid
  const res = await http.get<[]>("v2/teams");

  if (!Array.isArray(res))
    throw new Error("Invalid response from Upstash API. Check your API key and email.");

  log("✅ Connection to Upstash API is successful");
}
