import { config } from "../../config";
import { HttpClient } from "../../http";

const BOX_BASE_URL = "https://us-east-1.box.upstash.com";

export function getBoxClient(): HttpClient {
  const apiKey = config.boxApiKey;
  if (!apiKey) {
    throw new Error(
      "No Box API key configured. Start the server with --box-api-key or the UPSTASH_BOX_API_KEY env var."
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
  return new HttpClient({ baseUrl: BOX_BASE_URL, qstashToken: apiKey });
}
