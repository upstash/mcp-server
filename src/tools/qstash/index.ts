import type { CustomTool } from "../../tool";
import { qstashTools } from "./qstash";
import { workflowTools } from "./workflow";

export const qstashAllTools: Record<string, CustomTool> = {
  ...qstashTools,
  ...workflowTools,
};
