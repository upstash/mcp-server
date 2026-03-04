import { z } from "zod";

export const qstashCreds = {
  qstash_creds: z.undefined(),
  // qstash_creds: z
  //   .object({
  //     url: z.string(),
  //     token: z.string(),
  //   })
  //   .optional()
  //   .describe(
  //     "Optional qstash credentials. Use for local qstash connections and external qstash deployments"
  //   ),
};
