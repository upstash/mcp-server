import { McpServer } from "@modelcontextprotocol/server";
import { config } from "./config";
import { log } from "./log";
import { tools } from "./tools";
import { BOX_UPLOAD_TOOL } from "./tools/box/files";
import { handlerResponseToCallResult } from "./tool";
import z from "zod";
import { DEBUG } from ".";

/**
 * Session-level guidance sent in the initialize result when Box tools are
 * offered.
 *
 * This server also serves Redis and QStash, so the Box guidance is scoped to
 * tasks that involve a box rather than asserting anything about the session as
 * a whole. It exists because a box's filesystem is remote while the client's own
 * file and shell tools are local, and nothing in the protocol reports when the
 * two get mixed.
 */
const BOX_INSTRUCTIONS = `Working inside an Upstash Box:

A box is a remote Linux container. Its filesystem is not this machine's filesystem. Once a task is meant to happen in a box, do every step of it with the box tools: box_read, box_write, box_edit and box_list_files for files; box_git for git operations and for search (action 'exec' with ["grep", ...] or ["ls-files"]); box_exec for commands; box_preview to reach a server running inside the box.

Your own Read, Write, Edit and Bash tools act on the user's machine. Mixing them with box tools in one task splits it across two filesystems: an edit lands on one side while a command runs on the other, and neither side reports the mismatch. Decide which machine a task belongs to and stay there.

A box is addressed by box_id. Create one with box_manage — a workspace box needs no agent and no model — then reuse that same box_id for the rest of the task.`;

// Function to create a new server instance with all tools registered
export function createServerInstance() {
  const hasAccountKey = Boolean(config.email && config.apiKey);
  const hasBoxKey = Boolean(config.boxApiKey);

  const server = new McpServer(
    { name: "upstash", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
      instructions: hasBoxKey ? BOX_INSTRUCTIONS : undefined,
    }
  );

  // Readonly is a property of the account API key. Box tools authenticate
  // with the Box key instead, so it says nothing about them.
  const availableTools = config.readonly
    ? Object.fromEntries(Object.entries(tools).filter(([_, tool]) => tool.readonly || tool.box))
    : tools;

  // Each tool is offered only when the credential it authenticates with is
  // configured: Box tools need the Box API key, everything else needs the
  // account email and API key. A tool without its credential only buys a
  // round trip that fails.
  const scopedTools = Object.fromEntries(
    Object.entries(availableTools).filter(([_, tool]) => (tool.box ? hasBoxKey : hasAccountKey))
  );

  // box_upload reads the server host's filesystem on behalf of whoever calls
  // it, and the HTTP transport authenticates nobody, so it is only offered
  // there once an operator has named the directories it may read.
  const uploadAllowed = config.transport !== "http" || config.uploadRoots.length > 0;
  const filteredTools = uploadAllowed
    ? scopedTools
    : Object.fromEntries(Object.entries(scopedTools).filter(([name]) => name !== BOX_UPLOAD_TOOL));

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
