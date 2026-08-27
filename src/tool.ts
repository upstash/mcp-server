import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "./settings";

type HandlerResponse = string | string[] | CallToolResult;

export type CustomTool<TSchema extends z.ZodType = z.ZodType> = {
  description: string;

  /**
   * Zod schema for the input of the tool.
   */
  inputSchema?: TSchema;

  /**
   * Whether this tool is safe to use with a readonly API key.
   * Tools not marked as readonly will be hidden when a readonly key is detected.
   */
  readonly?: boolean;

  /**
   * Whether this tool talks to the Upstash Box API. Box tools authenticate
   * with the Box API key and are only offered when one is configured; every
   * other tool needs the account email and API key.
   */
  box?: boolean;

  /**
   * Whether this tool's result contains secrets (e.g. live database
   * credentials). The server never logs the result of a sensitive tool.
   *
   * The redaction in `log()` only masks secrets in JSON-shaped payloads, so
   * tools that return credentials in another format (markdown, plain text)
   * must set this.
   */
  sensitive?: boolean;

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

export function handlerResponseToCallResult(response: HandlerResponse): CallToolResult {
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
