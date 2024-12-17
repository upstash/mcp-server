import type { UpstashRequest } from "./http";

type Middleware = (req: UpstashRequest, next: () => Promise<unknown>) => Promise<unknown>;

const formatCreationTime = (obj: unknown) => {
  if (
    obj &&
    typeof obj === "object" &&
    "creation_time" in obj &&
    typeof obj.creation_time === "number" &&
    obj.creation_time > 0
  ) {
    obj.creation_time = new Date(obj.creation_time * 1000).toLocaleString();
  }
};

const middlewares: Middleware[] = [
  // Middleware to format creation_time field to human readable format
  async (req, next) => {
    const res = await next();
    if (Array.isArray(res)) {
      for (const element of res) {
        formatCreationTime(element);
      }
    } else {
      formatCreationTime(res);
    }
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
