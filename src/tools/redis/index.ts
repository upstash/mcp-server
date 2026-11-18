import { utilTools } from "../utils";
import { redisBackupTools } from "./backup";
import { redisCommandTools } from "./command";
import { redisDbOpsTools } from "./db";
import type { CustomTool } from "../../tool";

export const redisTools: Record<string, CustomTool> = {
  ...redisDbOpsTools,
  ...redisBackupTools,
  ...redisCommandTools,
  ...utilTools,
};
