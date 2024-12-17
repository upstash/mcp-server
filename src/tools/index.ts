import type { ZodSchema } from "zod";
import type { CustomTool } from "../tool";
import { redisTools } from "./redis";

export const json = (json: unknown) =>
  typeof json === "string" ? json : JSON.stringify(json, null, 2);

export const tools = {
  ...redisTools,
} as unknown as Record<string, CustomTool>;

// Only used for type inference
export function tool<TSchema extends ZodSchema>(tool: CustomTool<TSchema>) {
  return tool;
}
