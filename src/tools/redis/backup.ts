import { z } from "zod";
import { json, tool } from "..";
import { http } from "../../http";
import type { RedisBackup } from "./types";

export const redisBackupTools = {
  redis_database_create_backup: tool({
    description: `Create a backup of a specific Upstash redis database.`,
    inputSchema: z.object({
      database_id: z.string().describe("The ID of the database to create a backup for."),
      backup_name: z.string().describe("A name for the backup."),
    }),
    handler: async ({ database_id, backup_name }) => {
      await http.post(["v2/redis/create-backup", database_id], {
        name: backup_name,
      });

      return "OK";
    },
  }),

  redis_database_delete_backup: tool({
    description: `Delete a backup of a specific Upstash redis database.`,
    inputSchema: z.object({
      database_id: z.string().describe("The ID of the database to delete a backup from."),
      backup_name: z.string().describe("The name of the backup to delete."),
    }),
    handler: async ({ database_id, backup_name }) => {
      await http.delete(["v2/redis/delete-backup", database_id, backup_name]);

      return "OK";
    },
  }),

  redis_database_restore_backup: tool({
    description: `Restore a backup of a specific Upstash redis database. A backup can only be restored to the same database it was created from.`,
    inputSchema: z.object({
      database_id: z.string().describe("The ID of the database to restore a backup to."),
      backup_id: z.string().describe("The ID of the backup to restore."),
    }),
    handler: async ({ database_id, backup_id }) => {
      await http.post(["v2/redis/restore-backup", database_id], {
        backup_id,
      });

      return "OK";
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
      const backups = await http.get<RedisBackup[]>(["v2/redis/list-backups", database_id]);

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
