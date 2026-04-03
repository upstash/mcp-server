import { z } from "zod";
import { json, tool } from "../helpers";
import { boxCommon } from "./common";
import { getBoxClient } from "./utils";
import type { Box, BoxSnapshot } from "./types";

export const boxSnapshotsTool = {
  box_snapshots: tool({
    description: `Manage Upstash Box snapshots. Create full filesystem snapshots of a box, list snapshots, delete them, or restore a box from a snapshot.`,
    inputSchema: z.object({
      action: z
        .enum(["create", "list", "list_all", "delete", "restore"])
        .describe(
          "The action to perform. 'list' lists snapshots for a specific box, 'list_all' lists all your snapshots"
        ),
      box_id: z
        .string()
        .optional()
        .describe("Box ID (required for create, list, delete)"),
      snapshot_id: z
        .string()
        .optional()
        .describe("Snapshot ID (required for delete and restore)"),
      // Create-specific
      name: z.string().optional().describe("Name for the snapshot (auto-generated if empty)"),
      // Restore-specific
      model: z
        .string()
        .optional()
        .describe("LLM model for the restored box (required for restore)"),
      runtime: z
        .string()
        .optional()
        .describe("Override the snapshot's runtime for the restored box"),
      env_vars: z
        .record(z.string())
        .optional()
        .describe("Environment variables for the restored box"),
      ephemeral: z
        .boolean()
        .optional()
        .describe("Create the restored box as ephemeral"),
      ttl: z
        .number()
        .optional()
        .describe("TTL in seconds for the restored ephemeral box (max 259200)"),
      ...boxCommon,
    }),
    handler: async (params) => {
      const { action, box_id, snapshot_id } = params;
      const client = getBoxClient(params);

      switch (action) {
        case "create": {
          if (!box_id) throw new Error("box_id is required for create action");
          const body: Record<string, unknown> = {};
          if (params.name) body.name = params.name;

          const snapshot = await client.post<BoxSnapshot>(
            `v2/box/${box_id}/snapshots`,
            body
          );
          return [
            `Snapshot created (status: ${snapshot.status})`,
            `Snapshot ID: ${snapshot.id}`,
            json(snapshot),
          ];
        }

        case "list": {
          if (!box_id) throw new Error("box_id is required for list action");
          const response = await client.get<{ snapshots: BoxSnapshot[] }>(
            `v2/box/${box_id}/snapshots`
          );
          const snapshots = response.snapshots ?? [];
          return [
            `Found ${snapshots.length} snapshots for box ${box_id}`,
            json(snapshots),
          ];
        }

        case "list_all": {
          const response = await client.get<{ snapshots: BoxSnapshot[] }>("v2/box/snapshots");
          const snapshots = response.snapshots ?? [];
          return [
            `Found ${snapshots.length} snapshots total`,
            json(snapshots),
          ];
        }

        case "delete": {
          if (!box_id) throw new Error("box_id is required for delete action");
          if (!snapshot_id) throw new Error("snapshot_id is required for delete action");
          await client.delete(`v2/box/${box_id}/snapshots/${snapshot_id}`);
          return `Snapshot ${snapshot_id} deleted successfully`;
        }

        case "restore": {
          if (!snapshot_id) throw new Error("snapshot_id is required for restore action");
          if (!params.model) throw new Error("model is required for restore action");

          const body: Record<string, unknown> = {
            snapshot_id: snapshot_id,
            model: params.model,
          };
          if (params.runtime) body.runtime = params.runtime;
          if (params.env_vars) body.env_vars = params.env_vars;
          if (params.ephemeral !== undefined) body.ephemeral = params.ephemeral;
          if (params.ttl !== undefined) body.ttl = params.ttl;

          const box = await client.post<Box>("v2/box/from-snapshot", body);
          return [
            `Box restored from snapshot (status: ${box.status})`,
            `New Box ID: ${box.id}`,
            json(box),
          ];
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  }),
};
