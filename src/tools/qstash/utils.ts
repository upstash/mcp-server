import { http, createQStashClient, type HttpClient } from "../../http";
import type { QStashUser } from "./types";

let cachedCreds: { token: string; url: string } | null = null;
let credsExpiry: number = 0;

export async function getQStashCredentials(): Promise<{ token: string; url: string }> {
  const now = Date.now();

  if (cachedCreds && now < credsExpiry) {
    return cachedCreds;
  }

  try {
    const user = await http.get<QStashUser>("v2/qstash/user");
    cachedCreds = { token: user.token, url: "https://qstash.upstash.io" };
    credsExpiry = now + 60 * 60 * 1000;
    return cachedCreds;
  } catch (error) {
    throw new Error(
      `Failed to get QStash credentials: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function createQStashClientWithToken(
  creds: {
    url?: string;
    token?: string;
  } = {}
): Promise<HttpClient> {
  if (!creds?.token) {
    const fetched = await getQStashCredentials();
    creds.token = fetched.token;
    creds.url ??= fetched.url;
  }
  return createQStashClient({
    url: creds?.url,
    token: creds?.token,
  });
}

export function clearTokenCache(): void {
  cachedCreds = null;
  credsExpiry = 0;
}
