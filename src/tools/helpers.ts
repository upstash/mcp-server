import type { z } from "zod";
import type { CustomTool } from "../tool";

export const json = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

export function tool<TSchema extends z.ZodType>(t: CustomTool<TSchema>): CustomTool {
  return t as unknown as CustomTool;
}
