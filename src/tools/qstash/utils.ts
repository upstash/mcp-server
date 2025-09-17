import { http, createQStashClient, type HttpClient } from "../../http";
import type { QStashUser } from "./types";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Gets the QStash token from the Upstash API
 * Caches the token for 1 hour to avoid unnecessary API calls
 */
export async function getQStashToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if it's still valid (cached for 1 hour)
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  try {
    const user = await http.get<QStashUser>("qstash/user");
    cachedToken = user.token;
    tokenExpiry = now + 60 * 60 * 1000; // Cache for 1 hour
    return user.token;
  } catch (error) {
    throw new Error(
      `Failed to get QStash token: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates a QStash client with automatically fetched token
 */
export async function createQStashClientWithToken(
  creds: {
    url?: string;
    token?: string;
  } = {}
): Promise<HttpClient> {
  if (!creds?.token) {
    creds.token = await getQStashToken();
  }
  return createQStashClient({
    url: creds?.url,
    token: creds?.token,
  });
}

/**
 * Clears the cached token (useful for testing or when token becomes invalid)
 */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = 0;
}
