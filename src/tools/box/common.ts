import { z } from "zod";
import { config } from "../../config";

const BOX_BASE_URL = "https://us-east-1.box.upstash.com";

export function buildBoxCommon() {
  const hasConfigKey = Boolean(config.boxApiKey);
  return {
    box_api_key: hasConfigKey
      ? z
          .string()
          .optional()
          .describe(
            "NOTE: The api key is already pre-configured at server startup; only pass this to override the configured key."
          )
      : z
          .string()
          .describe(
            "Box API key (starts with 'box_'). Check the project's .env file for BOX_API_KEY, or ask the user for it."
          ),
  };
}

export { BOX_BASE_URL };
