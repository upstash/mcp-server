import { http, createQStashClient, type HttpClient } from "../../http";
import type { QStashUser } from "./types";

const LOCAL_QSTASH_TOKEN =
  "eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=";

const REGION_URLS: Record<string, string> = {
  eu: "https://qstash-eu-central-1.upstash.io",
  us: "https://qstash-us-east-1.upstash.io",
};

let cachedCreds: { token: string } | null = null;
let credsExpiry: number = 0;

export async function getQStashCredentials(): Promise<{ token: string }> {
  const now = Date.now();

  if (cachedCreds && now < credsExpiry) {
    return cachedCreds;
  }

  try {
    const user = await http.get<QStashUser>("v2/qstash/user");
    cachedCreds = { token: user.token };
    credsExpiry = now + 60 * 60 * 1000;
    return cachedCreds;
  } catch (error) {
    throw new Error(
      `Failed to get QStash credentials: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function createQStashClientWithToken(options: {
  qstash_creds?: { url: string; token: string };
  region: string;
  local_mode_port: number;
}): Promise<HttpClient> {
  const { qstash_creds, region, local_mode_port } = options;

  if (qstash_creds) {
    return createQStashClient({ url: qstash_creds.url, token: qstash_creds.token });
  }

  if (region === "local") {
    const port = local_mode_port ?? 8080;
    return createQStashClient({
      url: `http://localhost:${port}`,
      token: LOCAL_QSTASH_TOKEN,
    });
  }

  const fetched = await getQStashCredentials();
  const url = region && REGION_URLS[region] ? REGION_URLS[region] : REGION_URLS["eu"];
  return createQStashClient({ url, token: fetched.token });
}

export function clearTokenCache(): void {
  cachedCreds = null;
  credsExpiry = 0;
}
