import { z } from "zod";
import { json, tool } from "../helpers";
import { boxCommon } from "./common";
import { getBoxClient } from "./utils";
import type { BoxPreview, CreatePreviewResponse } from "./types";

export const boxPreviewTool = {
  box_preview: tool({
    description: `Manage preview URLs for web applications running inside an Upstash Box. Create public URLs to access services running on specific ports, list existing previews, or delete them.`,
    inputSchema: z.object({
      action: z
        .enum(["create", "list", "delete"])
        .describe("The action to perform"),
      box_id: z.string().describe("The box ID"),
      port: z
        .number()
        .min(1)
        .max(65535)
        .optional()
        .describe("Port number (required for create and delete)"),
      basic_auth: z
        .boolean()
        .optional()
        .describe("Enable basic auth on the preview URL (create only)"),
      bearer_token: z
        .boolean()
        .optional()
        .describe("Enable bearer token auth on the preview URL (create only)"),
      ...boxCommon,
    }),
    handler: async (params) => {
      const { action, box_id, port, basic_auth, bearer_token } = params;
      const client = getBoxClient(params);

      switch (action) {
        case "create": {
          if (!port) throw new Error("port is required for create action");
          const body: Record<string, unknown> = { port };
          if (basic_auth) body.basic_auth = basic_auth;
          if (bearer_token) body.bearer_token = bearer_token;

          const response = await client.post<CreatePreviewResponse>(
            `v2/box/${box_id}/preview`,
            body
          );

          const result: string[] = [
            `Preview URL created: ${response.url}`,
            `Port: ${response.port}`,
          ];
          if (response.username) result.push(`Username: ${response.username}`);
          if (response.password) result.push(`Password: ${response.password}`);
          if (response.token) result.push(`Token: ${response.token}`);
          return result;
        }

        case "list": {
          const response = await client.get<{ previews: BoxPreview[] }>(
            `v2/box/${box_id}/preview`
          );
          const previews = response.previews ?? [];
          return [
            `Found ${previews.length} preview URLs`,
            json(previews),
          ];
        }

        case "delete": {
          if (!port) throw new Error("port is required for delete action");
          await client.delete(`v2/box/${box_id}/preview/${port}`);
          return `Preview for port ${port} deleted successfully`;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  }),
};
