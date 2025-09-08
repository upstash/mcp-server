import type { UpstashRequest } from "./http";

type Middleware = (req: UpstashRequest, next: () => Promise<unknown>) => Promise<unknown>;

const formatTimestamps = (obj: unknown): void => {
  if (!obj || typeof obj !== "object") {
    return;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    for (const item of obj) {
      formatTimestamps(item);
    }
    return;
  }

  // Handle objects
  for (const [key, value] of Object.entries(obj)) {
    // Check if key matches our criteria: contains "creationTime" or has "createdAt" anywhere (case-insensitive)
    const shouldFormat =
      typeof value === "number" &&
      (key === "creationTime" ||
        key === "creation_time" ||
        key === "time" ||
        key.toLowerCase().includes("createdat"));

    if (shouldFormat && typeof value === "number" && value > 0) {
      // Format timestamp to human readable format
      // Assume timestamps > 1_000_000_000_000 are in milliseconds, otherwise seconds
      const timestamp = value > 1_000_000_000_000 ? value : value * 1000;

      // Show milliseconds in the human readable format

      const formatted = new Date(timestamp).toLocaleString("en-US", { timeZoneName: "short" });
      (obj as any)[key] = `${formatted} (${value})`;
    } else if (value && typeof value === "object") {
      // Recursively process nested objects
      formatTimestamps(value);
    }
  }
};

const middlewares: Middleware[] = [
  // Middleware to format timestamp fields to human readable format
  async (req, next) => {
    const res = await next();
    formatTimestamps(res);
    return res;
  },
];

export const applyMiddlewares = async (
  req: UpstashRequest,
  func: (req: UpstashRequest) => Promise<unknown>
) => {
  let next = async () => func(req);
  for (const middleware of middlewares.reverse()) {
    const prevNext = next;
    next = async () => middleware(req, prevNext);
  }
  return next();
};
