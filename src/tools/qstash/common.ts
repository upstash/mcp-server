import { z } from "zod";

export const qstashCommon = {
  region: z
    .enum(["eu", "us", "local"])
    .default("eu")
    .describe("QStash region to use. To use local mode, pick `local`"),
  local_mode_port: z
    .number()
    .default(6488)
    .describe(
      "Only provide when using local mode and if default does not work, the port is usually in the .env file"
    ),
  qstash_creds: z
    .object({
      url: z.string(),
      token: z.string(),
    })
    .optional()
    .describe("Custom qstash credentials, overrides `region`"),
};
