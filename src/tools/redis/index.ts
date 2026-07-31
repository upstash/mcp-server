import { utilTools } from "../utils";
import { redisBackupTools } from "./backup";
import { redisCommandTools } from "./command";
import { redisDbOpsTools } from "./db";
import { startRedisTools } from "./start-redis";
import type { CustomTool } from "../../tool";

export const redisTools: Record<string, CustomTool> = {
  ...redisDbOpsTools,
  ...startRedisTools,
  ...redisBackupTools,
  ...redisCommandTools,
  ...utilTools,
};
