import type { ZodSchema } from "zod";
import type { CustomTool } from "../tool";

export const json = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

export function tool<TSchema extends ZodSchema>(t: CustomTool<TSchema>): CustomTool {
  return t as unknown as CustomTool;
}
