import type { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ZodSchema } from "zod";
import type { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "./settings";

type HandlerResponse = string | string[] | z.infer<typeof CallToolResultSchema>;

export type CustomTool<TSchema extends ZodSchema = ZodSchema> = {
  description: string;

  /**
   * Zod schema for the input of the tool.
   */
  inputSchema?: TSchema;

  /**
   * The handler function for the tool.
   * @param input Parsed input according to the input schema.
   * @returns
   * If result is a string, it will be displayed as a single text block.
   * If result is an array of strings, each string will be displayed as a separate text block.
   * You can also return a CallToolResult object to display more complex content.
   */
  handler: (input: z.infer<TSchema>) => Promise<HandlerResponse>;
};

export function handlerResponseToCallResult(
  response: HandlerResponse
): z.infer<typeof CallToolResultSchema> {
  if (typeof response === "string" || Array.isArray(response)) {
    const array = Array.isArray(response) ? response : [response];

    // Truncate messages that are too long
    const truncatedArray = array.map((item) =>
      item.length > MAX_MESSAGE_LENGTH
        ? `${item.slice(0, MAX_MESSAGE_LENGTH)}... (MESSAGE TRUNCATED, MENTION THIS TO USER)`
        : item
    );

    return {
      content: truncatedArray.map((text) => ({ type: "text" as const, text })),
    };
  } else return response;
}
