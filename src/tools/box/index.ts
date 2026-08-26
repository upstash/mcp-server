import type { CustomTool } from "../../tool";
import { boxManageTool } from "./manage";
import { boxExecTool } from "./exec";
import { boxFilesTool } from "./files";
import { boxGitTool } from "./git";
import { boxAgentRunTool } from "./agent-run";
import { boxLogsTool } from "./logs";
import { boxRunsTool } from "./runs";
import { boxPreviewTool } from "./preview";
import { boxSnapshotsTool } from "./snapshots";

export const boxTools: Record<string, CustomTool> = {
  ...boxManageTool,
  ...boxExecTool,
  ...boxFilesTool,
  ...boxGitTool,
  ...boxAgentRunTool,
  ...boxLogsTool,
  ...boxRunsTool,
  ...boxPreviewTool,
  ...boxSnapshotsTool,
};
