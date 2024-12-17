import { redisBackupTools } from "./backup";
import { redisCommandTools } from "./command";
import { redisDbOpsTools } from "./db";

export const redisTools = {
  ...redisDbOpsTools,
  ...redisBackupTools,
  ...redisCommandTools,
};
