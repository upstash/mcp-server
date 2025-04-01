import { describe, expect, it } from "vitest";
import type { CustomTool } from "./tool";
import { convertToTools } from "./tool";
import { z } from "zod";

describe("convertToTools", () => {
  it("should convert Zod schema to JSON schema", () => {
    const toolsObj: Record<string, CustomTool> = {
      foo_method: {
        description: "Foo method",
        inputSchema: z.object({
          name: z.string().describe("Name of the user"),
          age: z.number().describe("Age of the user"),
        }),
        handler: async () => {},
      },
    };

    const result = convertToTools(toolsObj);
    expect(result).toEqual([
      {
        name: "foo_method",
        description: "Foo method",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the user",
            },
            age: {
              type: "number",
              description: "Age of the user",
            },
          },
          required: ["name", "age"],
        },
      },
    ]);
  });

  it("should convert multiple Zod schemas to JSON schemas", () => {
    const toolsObj: Record<string, CustomTool> = {
      foo_method: {
        description: "Foo method",
        inputSchema: z.object({
          name: z.string().describe("Name of the user"),
          age: z.number().describe("Age of the user"),
        }),
        handler: async () => {},
      },
      bar_method: {
        description: "Bar method",
        inputSchema: z.object({
          email: z.string().describe("Email of the user"),
          nested: z
            .object({
              count: z.number().describe("Count of the user"),
            })
            .describe("Nested object"),
        }),
        handler: async () => {},
      },
    };

    const result = convertToTools(toolsObj);

    expect(result).toEqual([
      {
        name: "foo_method",
        description: "Foo method",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the user",
            },
            age: {
              type: "number",
              description: "Age of the user",
            },
          },
          required: ["name", "age"],
        },
      },
      {
        name: "bar_method",
        description: "Bar method",
        inputSchema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "Email of the user",
            },
            nested: {
              type: "object",
              properties: {
                count: {
                  type: "number",
                  description: "Count of the user",
                },
              },
              required: ["count"],
              description: "Nested object",
            },
          },
          required: ["email", "nested"],
        },
      },
    ]);
  });
});
