import { config } from "../../config";
import { HttpClient } from "../../http";
import { BOX_BASE_URL } from "./common";

export function getBoxClient(params: { box_api_key?: string }): HttpClient {
  const apiKey = params.box_api_key || config.boxApiKey;
  if (!apiKey) {
    throw new Error(
      "No Box API key available. Pass box_api_key as a tool argument, or configure the server with --box-api-key / UPSTASH_BOX_API_KEY env var."
    );
  }
  return new HttpClient({
    baseUrl: BOX_BASE_URL,
    qstashToken: apiKey,
  });
}
