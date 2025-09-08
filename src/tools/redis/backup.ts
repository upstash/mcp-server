import { z } from "zod";
import { json, tool } from "..";
import { http } from "../../http";
import type { RedisBackup } from "./types";

export const redisBackupTools = {
  redis_database_manage_backup: tool({
    description: `Create, delete, or restore backups for a specific Upstash redis database. This tool handles all backup operations in one unified interface.`,
    inputSchema: z
      .object({
        database_id: z.string().describe("The ID of the database to manage backups for."),
        operation: z
          .union([z.literal("create"), z.literal("delete"), z.literal("restore")])
          .describe("The backup operation to perform: create, delete, or restore."),
        backup_name: z
          .string()
          .optional()
          .describe("Name for the backup (required for create operation)."),
        backup_id: z
          .string()
          .optional()
          .describe("ID of the backup (required for delete and restore operations)."),
      })
      .refine(
        (data) => {
          if (data.operation === "create" && !data.backup_name) {
            return false;
          }
          if ((data.operation === "delete" || data.operation === "restore") && !data.backup_id) {
            return false;
          }
          return true;
        },
        {
          message:
            "backup_name is required for create operation, backup_id is required for delete and restore operations",
        }
      ),
    handler: async ({ database_id, operation, backup_name, backup_id }) => {
      switch (operation) {
        case "create": {
          if (!backup_name) {
            throw new Error("backup_name is required for create operation");
          }
          await http.post(["v2/redis/create-backup", database_id], {
            name: backup_name,
          });
          return `Backup "${backup_name}" created successfully for database ${database_id}.`;
        }

        case "delete": {
          if (!backup_id) {
            throw new Error("backup_id is required for delete operation");
          }
          await http.delete(["v2/redis/delete-backup", database_id, backup_id]);
          return `Backup ${backup_id} deleted successfully from database ${database_id}.`;
        }

        case "restore": {
          if (!backup_id) {
            throw new Error("backup_id is required for restore operation");
          }
          await http.post(["v2/redis/restore-backup", database_id], {
            backup_id,
          });
          return `Backup ${backup_id} restored successfully to database ${database_id}.`;
        }

        default: {
          throw new Error(`Invalid operation: ${operation}. Use create, delete, or restore.`);
        }
      }
    },
  }),

  redis_database_list_backups: tool({
    // TODO: Add explanation for fields
    // TODO: Is this in bytes?
    description: `List all backups of a specific Upstash redis database.`,
    inputSchema: z.object({
      database_id: z.string().describe("The ID of the database to list backups for."),
    }),
    handler: async ({ database_id }) => {
      const backups = await http.get<RedisBackup[]>(["v2/redis/list-backup", database_id]);

      return json(backups);
    },
  }),

  redis_database_set_daily_backup: tool({
    description: `Enable or disable daily backups for a specific Upstash redis database.`,
    inputSchema: z.object({
      database_id: z
        .string()
        .describe("The ID of the database to enable or disable daily backups for."),
      enable: z.boolean().describe("Whether to enable or disable daily backups."),
    }),
    handler: async ({ database_id, enable }) => {
      await http.patch([
        `v2/redis/${enable ? "enable-dailybackup" : "disable-dailybackup"}`,
        database_id,
      ]);

      return "OK";
    },
  }),
};
