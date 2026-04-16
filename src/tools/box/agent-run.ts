import { z } from "zod";
import { tool } from "../helpers";
import { buildBoxCommon } from "./common";
import { getBoxClient } from "./utils";
type RunResponse = {
  run_id?: string;
  output?: string;
  metadata?: { input_tokens?: number; output_tokens?: number; cost_usd?: number };
};

export const boxAgentRunTool = {
  box_agent_run: tool({
    description: `Run an AI agent prompt inside an Upstash Box. The agent has access to shell, filesystem, and git inside the box. It reasons, executes commands, and iterates until the task is complete. This is a synchronous call that may take a while depending on the complexity of the prompt.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box ID to run the agent in"),
        prompt: z.string().describe("The natural-language prompt for the agent to execute"),
        model: z.string().optional().describe("Override the box's default LLM model for this run"),
        folder: z.string().optional().describe("Working directory inside the box for the agent"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, prompt, model, folder } = params;
      const client = getBoxClient(params);

      const body: Record<string, unknown> = { prompt };
      if (model) body.model = model;
      if (folder) body.folder = folder;

      const response = await client.post<RunResponse>(`v2/box/${box_id}/run`, body);

      const result: string[] = [`Agent run completed`];

      if (response.run_id) {
        result.push(`Run ID: ${response.run_id}`);
      }

      result.push(response.output || "(no output)");

      if (response.metadata) {
        result.push(
          `Tokens: ${response.metadata.input_tokens ?? 0} in / ${response.metadata.output_tokens ?? 0} out` +
            (response.metadata.cost_usd ? ` ($${response.metadata.cost_usd.toFixed(4)})` : "")
        );
      }

      return result;
    },
  }),
};
