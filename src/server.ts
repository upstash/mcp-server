import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./log";
import { tools } from "./tools";
import { convertToTools, handlerResponseToCallResult } from "./tool";

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
  log("< received tool call:", toolName, request.params.arguments);
  try {
    if (toolName in tools) {
      const tool = tools[toolName];
      const result = await tool.handler(request.params.arguments);

      const response = handlerResponseToCallResult(result);
      log("> tool result:", response.content.map((item) => item.text).join("\n"));

      return response;
    }
    throw new Error(`Unknown tool: ${toolName}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("> error in tool call:", msg);
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
