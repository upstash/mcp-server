import type { CustomTool } from "../tool";
import { redisTools } from "./redis";
import { qstashAllTools } from "./qstash";

export { json, tool } from "./helpers";

export const tools: Record<string, CustomTool> = {
  ...redisTools,
  ...qstashAllTools,
} as unknown as Record<string, CustomTool>;
