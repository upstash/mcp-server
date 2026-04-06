import { config } from "../../config";
import { http, createQStashClient, type HttpClient } from "../../http";
import type { QStashUser } from "./types";

const LOCAL_QSTASH_TOKEN =
  "eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=";

const REGION_URLS: Record<string, string> = {
  eu: "https://qstash-eu-central-1.upstash.io",
  us: "https://qstash-us-east-1.upstash.io",
};

const REGION_API_NAMES: Record<string, string> = {
  eu: "eu-central-1",
  us: "us-east-1",
};

let cachedUsers: QStashUser[] | null = null;
let cacheExpiry: number = 0;

export async function getQStashCredentials(region: string): Promise<{ token: string }> {
  const now = Date.now();

  if (!cachedUsers || now >= cacheExpiry) {
    try {
      cachedUsers = await http.get<QStashUser[]>("v2/qstash/users");
      cacheExpiry = now + 60 * 1000;
    } catch (error) {
      throw new Error(
        `Failed to get QStash credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const apiRegion = REGION_API_NAMES[region] ?? REGION_API_NAMES["eu"];
  const match = cachedUsers.find((u) => u.region === apiRegion);
  if (!match) {
    throw new Error(`No QStash user found for region '${region}' (${apiRegion})`);
  }

  return { token: match.token };
}

export async function createQStashClientWithToken(options: {
  qstash_creds?: { url: string; token: string };
  region: string;
  local_mode_port: number;
}): Promise<HttpClient> {
  if (config.readonly) {
    throw new Error(
      "QStash is not available in readonly mode yet. This feature will be implemented in the near future."
    );
  }

  const { qstash_creds, region, local_mode_port } = options;

  if (qstash_creds) {
    return createQStashClient({ url: qstash_creds.url, token: qstash_creds.token });
  }

  if (region === "local") {
    return createQStashClient({
      url: `http://localhost:${local_mode_port}`,
      token: LOCAL_QSTASH_TOKEN,
    });
  }

  const effectiveRegion = region && REGION_URLS[region] ? region : "eu";
  const fetched = await getQStashCredentials(effectiveRegion);
  return createQStashClient({ url: REGION_URLS[effectiveRegion], token: fetched.token });
}

export function clearTokenCache(): void {
  cachedUsers = null;
  cacheExpiry = 0;
}
