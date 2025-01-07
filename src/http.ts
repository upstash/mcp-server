import { config } from "./config";
import { log } from "./log";
import { applyMiddlewares } from "./middlewares";
import fetch from "node-fetch";

export type UpstashRequest = {
  method: string;
  path?: string[] | string;
  /**
   * Request body will be serialized to json
   */
  body?: unknown;
};

type HttpClientConfig = {
  baseUrl: string;
};

class HttpClient {
  private readonly baseUrl: string;

  public constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  public async get<TResponse>(path: string[] | string): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "GET", path });
  }

  public async post<TResponse>(path: string[] | string, body: unknown): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "POST", path, body });
  }

  public async patch<TResponse>(path: string[] | string, body?: unknown): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "PATCH", path, body });
  }

  public async delete<TResponse>(path: string[] | string): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "DELETE", path });
  }

  private async requestWithMiddleware<TResponse>(req: UpstashRequest): Promise<TResponse> {
    const res = await applyMiddlewares(req, async (req) => {
      return this.request<TResponse>(req);
    });

    return res as TResponse;
  }

  private async request<TResponse>(req: UpstashRequest): Promise<TResponse> {
    if (!req.path) {
      req.path = [];
    } else if (typeof req.path === "string") {
      req.path = [req.path];
    }

    const url = [this.baseUrl, ...req.path].join("/");
    const token = [config.email, config.apiKey].join(":");

    const init: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(token).toString("base64")}`,
      },
    };

    if (req.method !== "GET") {
      init.body = JSON.stringify(req.body);
    }

    log("Sending request", {
      url,
      ...init,
      headers: { ...init.headers, Authorization: "***" },
    });

    // fetch is defined by isomorphic fetch
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`Request failed (${res.status} ${res.statusText}): ${await res.text()}`);
    }
    return (await res.json()) as TResponse;
  }
}

export const http = new HttpClient({ baseUrl: "https://api.upstash.com" });
