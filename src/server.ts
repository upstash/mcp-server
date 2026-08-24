import { McpServer } from "@modelcontextprotocol/server";
import { config } from "./config";
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

  const filteredTools = config.readonly
    ? Object.fromEntries(Object.entries(tools).filter(([_, tool]) => tool.readonly))
    : tools;

  const toolsList = Object.entries(filteredTools).map(([name, tool]) => ({
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
        inputSchema: tool.inputSchema ?? z.object({}),
      },
      async (args) => {
        log("< received tool call:", toolName, args);

        try {
          const result = await tool.handler(args);
          const response = handlerResponseToCallResult(result);
          log(
            "> tool result:",
            tool.sensitive
              ? "<redacted: tool returns credentials>"
              : response.content.map((item) => ("text" in item ? item.text : "")).join("\n")
          );
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
                      type: "text" as const,
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
