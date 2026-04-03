import { z } from "zod";
import { json, tool } from "../helpers";
import { boxCommon } from "./common";
import { getBoxClient } from "./utils";
import type { Box } from "./types";

export const boxManageTool = {
  box_manage: tool({
    description: `Manage Upstash Box containers. Supports creating, listing, getting, deleting, pausing, resuming, and forking boxes. Boxes are secure cloud containers with built-in AI agent capabilities.`,
    inputSchema: z.object({
      action: z
        .enum(["create", "list", "get", "delete", "pause", "resume", "fork"])
        .describe("The action to perform"),
      box_id: z
        .string()
        .optional()
        .describe("Box ID (required for get, delete, pause, resume, fork)"),
      // Create-specific fields
      name: z.string().optional().describe("Display name for the box"),
      model: z
        .string()
        .optional()
        .describe("LLM model to use (e.g. 'claude/sonnet_4_6', 'openai/o4-mini'). Required for create"),
      agent: z
        .enum(["claude-code", "codex", "opencode"])
        .optional()
        .default("claude-code")
        .describe("Agent type (default: claude-code)"),
      runtime: z
        .string()
        .optional()
        .default("node")
        .describe("Runtime environment (e.g. 'node', 'python')"),
      agent_api_key: z
        .string()
        .optional()
        .describe("API key for the AI agent provider. Empty uses managed key"),
      env_vars: z
        .record(z.string())
        .optional()
        .describe("Environment variables to set in the box"),
      clone_repo: z
        .string()
        .optional()
        .describe("Git repository URL to clone into the box"),
      clone_token: z
        .string()
        .optional()
        .describe("Token for cloning private repositories"),
      ephemeral: z
        .boolean()
        .optional()
        .describe("If true, box auto-deletes after TTL expires"),
      ttl: z
        .number()
        .optional()
        .describe("Time-to-live in seconds for ephemeral boxes (max 259200 = 3 days)"),
      // List-specific fields
      status: z
        .enum(["active", "deleted"])
        .optional()
        .describe("Filter for list action: 'active' (default) or 'deleted'"),
      ...boxCommon,
    }),
    handler: async (params) => {
      const { action, box_id } = params;
      const client = getBoxClient(params);

      switch (action) {
        case "create": {
          if (!params.model) {
            throw new Error("model is required for create action");
          }
          const body: Record<string, unknown> = {
            model: params.model,
          };
          if (params.name) body.name = params.name;
          if (params.agent) body.agent = params.agent;
          if (params.runtime) body.runtime = params.runtime;
          if (params.agent_api_key) body.agent_api_key = params.agent_api_key;
          if (params.env_vars) body.env_vars = params.env_vars;
          if (params.clone_repo) body.clone_repo = params.clone_repo;
          if (params.clone_token) body.clone_token = params.clone_token;
          if (params.ephemeral !== undefined) body.ephemeral = params.ephemeral;
          if (params.ttl !== undefined) body.ttl = params.ttl;

          const box = await client.post<Box>("v2/box", body);
          return [
            `Box created successfully (status: ${box.status})`,
            `Box ID: ${box.id}`,
            json(box),
          ];
        }

        case "list": {
          const query: Record<string, string | undefined> = {};
          if (params.status === "deleted") query.status = "deleted";
          const boxes = await client.get<Box[]>("v2/box", query);
          return [
            `Found ${boxes.length} boxes`,
            json(boxes),
          ];
        }

        case "get": {
          if (!box_id) throw new Error("box_id is required for get action");
          const box = await client.get<Box>(`v2/box/${box_id}`);
          return [
            `Box ${box_id} (status: ${box.status})`,
            json(box),
          ];
        }

        case "delete": {
          if (!box_id) throw new Error("box_id is required for delete action");
          await client.delete(`v2/box/${box_id}`);
          return `Box ${box_id} deleted successfully`;
        }

        case "pause": {
          if (!box_id) throw new Error("box_id is required for pause action");
          await client.post(`v2/box/${box_id}/pause`);
          return `Box ${box_id} paused successfully`;
        }

        case "resume": {
          if (!box_id) throw new Error("box_id is required for resume action");
          await client.post(`v2/box/${box_id}/resume`);
          return `Box ${box_id} resumed successfully`;
        }

        case "fork": {
          if (!box_id) throw new Error("box_id is required for fork action");
          const forked = await client.post<Box>(`v2/box/${box_id}/fork`);
          return [
            `Box forked successfully`,
            `New Box ID: ${forked.id}`,
            json(forked),
          ];
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  }),
};
