import { config } from "./config";
import { log } from "./log";
import { applyMiddlewares } from "./middlewares";
import { json } from "./tools/helpers";
import { telemetry } from "./telemetry";

export type UpstashRequest = {
  method: string;
  path?: string[] | string;
  /**
   * Request body will be serialized to json
   */
  body?: unknown;
  /**
   * Query parameters, object and undefined will be ignored
   */
  query?: Record<string, string | number | boolean | undefined | object>;
  /**
   * Custom headers
   */
  headers?: Record<string, string>;
  /**
   * Optional QStash token - if provided, will use Bearer auth instead of Basic auth
   */
  qstashToken?: string;
  /**
   * Abort the request after this many milliseconds.
   *
   * There is no default: the coordinator holds a shell exec open for up to an
   * hour, so a long-running command must be able to finish. Callers that can
   * hang (box_exec) set their own bound.
   */
  timeoutMs?: number;
};

export type HttpClientConfig = {
  baseUrl: string;
  /**
   * Optional QStash token for Bearer authentication
   */
  qstashToken?: string;
};

export class HttpClient {
  private readonly baseUrl: string;
  private readonly qstashToken?: string;

  public constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.qstashToken = config.qstashToken;
  }

  public async get<TResponse>(
    path: string[] | string,
    query?: Record<string, string | number | boolean | undefined | object>
  ): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "GET", path, query });
  }

  public async post<TResponse>(
    path: string[] | string,
    body?: unknown,
    headers?: Record<string, string>,
    options?: { timeoutMs?: number }
  ): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({
      method: "POST",
      path,
      body,
      headers,
      ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
  }

  public async put<TResponse>(
    path: string[] | string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "PUT", path, body, headers });
  }

  public async patch<TResponse>(path: string[] | string, body?: unknown): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "PATCH", path, body });
  }

  public async delete<TResponse>(path: string[] | string, body?: unknown): Promise<TResponse> {
    return this.requestWithMiddleware<TResponse>({ method: "DELETE", path, body });
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

    let url = [this.baseUrl, ...req.path].join("/");

    // Add query parameters
    if (req.query) {
      const queryPairs: string[] = [];
      for (const [key, value] of Object.entries(req.query)) {
        if (value !== undefined && value !== null && typeof value !== "object") {
          queryPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      }
      if (queryPairs.length > 0) {
        url += `?${queryPairs.join("&")}`;
      }
    }

    // Determine authentication method
    const qstashToken = req.qstashToken || this.qstashToken;
    let authHeader: string;

    if (qstashToken) {
      authHeader = `Bearer ${qstashToken}`;
    } else {
      const token = [config.email, config.apiKey].join(":");
      authHeader = `Basic ${Buffer.from(token).toString("base64")}`;
    }

    const telemetryHeaders: Record<string, string> = config.disableTelemetry
      ? {}
      : {
          "Upstash-Telemetry-Runtime": telemetry.runtime,
          "Upstash-Telemetry-Platform": telemetry.platform,
          "Upstash-Telemetry-Sdk": telemetry.sdk,
        };

    const init: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        ...telemetryHeaders,
        ...req.headers,
      } as Record<string, string>,
    };

    if (req.method !== "GET" && req.body !== undefined) {
      if (req.body instanceof FormData) {
        // Multipart: fetch has to set Content-Type itself so the boundary
        // matches the body it encodes.
        init.body = req.body;
        delete (init.headers as Record<string, string>)["Content-Type"];
      } else {
        init.body = JSON.stringify(req.body);
      }
    }

    log("-> sending request", {
      url,
      ...init,
      ...(init.body instanceof FormData ? { body: "<multipart form data>" } : {}),
      headers: {
        ...init.headers,
        Authorization: "***",
      },
    });

    if (req.timeoutMs !== undefined) {
      init.signal = AbortSignal.timeout(req.timeoutMs);
    }

    // fetch is defined by isomorphic fetch
    const res = await fetch(url, init).catch((error: unknown) => {
      // An aborted fetch surfaces as a bare TimeoutError; say what timed out.
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `Request timed out after ${String(req.timeoutMs)}ms: ${req.method} ${url.split("?")[0]}`
        );
      }
      throw error;
    });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status} ${res.statusText}): ${await res.text()}`);
    }

    // Handle empty responses
    const text = await res.text();
    if (!text) {
      return {} as TResponse;
    }

    const result = safeParseJson(text) as TResponse;

    if (result) {
      log("<- received response", json(result));
    } else {
      log("<- received text response", text);
    }

    return result || (text as TResponse);
  }
}

const safeParseJson = <TResponse>(text: string) => {
  try {
    return JSON.parse(text) as TResponse;
  } catch {
    return;
  }
};

export const http = new HttpClient({ baseUrl: "https://api.upstash.com" });

/**
 * Creates a QStash-enabled HttpClient with the provided token
 */
export function createQStashClient({ url, token }: { url?: string; token: string }): HttpClient {
  return new HttpClient({
    baseUrl: url ?? "https://qstash.upstash.io",
    qstashToken: token,
  });
}
