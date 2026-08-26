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
  // The account API key and the Box API key are different credentials on
  // different APIs, and sending the wrong one returns a bare "Invalid token"
  // that names neither. Box keys are prefixed, so say it here instead.
  if (!apiKey.startsWith("box_")) {
    throw new Error(
      "That does not look like an Upstash Box API key: Box keys start with 'box_'. An Upstash account API key will not work for Box tools — create a Box key in the Upstash console."
    );
  }
  return new HttpClient({
    baseUrl: BOX_BASE_URL,
    qstashToken: apiKey,
  });
}
