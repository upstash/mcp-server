import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./log";
import { tools } from "./tools";
import { convertToTools } from "./tool";

export const server = new Server(
  { name: "upstash", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const toolsList = convertToTools(tools);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  log("Received list tools request", toolsList);
  return { tools: toolsList };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  log("Received tool call:", toolName);
  try {
    if (toolName in tools) {
      const tool = tools[toolName];
      const result = await tool.handler(request.params.arguments);

      if (typeof result === "string") {
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      } else if (Array.isArray(result)) {
        return {
          content: result.map((item) => ({
            type: "text",
            text: item,
          })),
        };
      }
      return result;
    }
    throw new Error(`Unknown tool: ${toolName}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("Error in tool call:", msg);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${msg}`,
        },
      ],
      isError: true,
    };
  }
});
