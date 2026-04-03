import { z } from "zod";

const BOX_BASE_URL = "https://us-east-1.box.upstash.com";

export const boxCommon = {
  box_api_key: z
    .string()
    .describe("Box API key (starts with 'box_' or 'abx_')"),
};

export { BOX_BASE_URL };
