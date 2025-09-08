import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "./log";
import { tools } from "./tools";
import { handlerResponseToCallResult } from "./tool";
import z from "zod";
import { DEBUG } from ".";

// Function to create a new server instance with all tools registered
export function createServerInstance() {
  const server = new McpServer(
    { name: "upstash", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
    }
  );

  const toolsList = Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    tool,
  }));

  // Register all tools from the toolsList
  for (const toolDef of toolsList) {
    const toolName = toolDef.name;
    const tool = toolDef.tool;

    server.registerTool(
      toolName,
      {
        description: tool.description,
        inputSchema: ((tool.inputSchema ?? z.object({})) as any).shape,
      },
      // @ts-expect-error - Just ignore the types here
      async (args) => {
        log("< received tool call:", toolName, args);

        try {
          const result = await tool.handler(args);
          const response = handlerResponseToCallResult(result);
          log("> tool result:", response.content.map((item) => item.text).join("\n"));
          return response;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          log("> error in tool call:", msg);
          return {
            content: [
              {
                type: "text",
                text: `${error instanceof Error ? error.name : "Error"}: ${msg}`,
              },
              ...(DEBUG
                ? [
                    {
                      type: "text",
                      text: `\nStack trace: ${error instanceof Error ? error.stack : "No stack trace available"}`,
                    },
                  ]
                : []),
            ],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
