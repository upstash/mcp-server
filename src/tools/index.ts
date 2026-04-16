import type { CustomTool } from "../tool";
import { redisTools } from "./redis";
import { qstashAllTools } from "./qstash";
import { boxTools } from "./box";

export { json, tool } from "./helpers";

export const tools: Record<string, CustomTool> = {
  ...redisTools,
  ...qstashAllTools,
  ...boxTools,
} as unknown as Record<string, CustomTool>;
