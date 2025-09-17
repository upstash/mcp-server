import { z } from "zod";
import { json, tool } from "..";
import { http } from "../../http";
import { createQStashClientWithToken } from "./utils";
import type {
  QStashUser,
  QStashLogsResponse,
  QStashDLQResponse,
  QStashDLQMessage,
  QStashSchedule,
  QStashScheduleCreateResponse,
} from "./types";

export const qstashCreds = {
  qstash_creds: z.undefined(),
  // qstash_creds: z
  //   .object({
  //     url: z.string(),
  //     token: z.string(),
  //   })
  //   .optional()
  //   .describe(
  //     "Optional qstash credentials. Use for local qstash connections and external qstash deployments"
  //   ),
};

// First, we need to get the QStash token
export const qstashTools = {
  qstash_get_user_token: tool({
    description: `Get the QSTASH_TOKEN and QSTASH_URL of the current user. This
    is not needed for the mcp tools since the token is automatically fetched from
    the Upstash API for them.`,
    handler: async () => {
      const user = await http.get<QStashUser>("qstash/user");
      return [json(user)];
    },
  }),

  qstash_publish_message: tool({
    description: `Publish a message to a destination URL using QStash. This
    sends an HTTP request to the specified destination via QStash's message
    queue. This can also be used to trigger a upstash workflow run.`,
    inputSchema: z.object({
      destination: z
        .string()
        .describe("The destination URL to send the message to (e.g., 'https://example.com')"),
      body: z.string().optional().describe("Request body (JSON string or plain text)"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
        .optional()
        .describe("HTTP method (optional, defaults to POST)")
        .default("POST"),
      delay: z
        .string()
        .optional()
        .describe("Delay before message delivery (e.g., '10s', '5m', '1h')"),
      retries: z.number().optional().describe("Number of retries on failure, default is 3"),
      callback: z
        .string()
        .optional()
        .describe("Callback URL that will be called when the message is successfully delivered"),
      failureCallback: z
        .string()
        .optional()
        .describe("Callback URL that will be called when the message is failed to deliver"),
      timeout: z.string().optional().describe("Request timeout (e.g., '30s', '1h')"),
      queueName: z
        .string()
        .optional()
        .describe(
          "Queue name to use, you have to first create the queue in upstash. Prefer the flow control key instead"
        ),
      flow_control: z
        .object({
          key: z
            .string()
            .describe("Unique identifier for grouping messages under same flow control rules"),
          parallelism: z
            .number()
            .optional()
            .describe("Max concurrent active calls (default: unlimited)"),
          rate: z.number().optional().describe("Max calls per period (default: unlimited)"),
          period: z
            .string()
            .optional()
            .describe("Time window for rate limit (e.g., '1s', '1m', '1h', default: '1s')"),
        })
        .optional()
        .describe("Flow control for rate limiting and parallelism management"),

      extraHeaders: z.record(z.string()).optional().describe("Extra headers to add to the request"),
      ...qstashCreds,
    }),
    handler: async ({
      destination,
      body,
      method,
      extraHeaders,
      delay,
      retries,
      callback,
      failureCallback,
      timeout,
      queueName,
      flow_control,
      qstash_creds,
    }) => {
      const client = await createQStashClientWithToken(qstash_creds);

      const requestHeaders: Record<string, string> = {};

      if (method) {
        requestHeaders["Upstash-Method"] = method;
      }
      if (delay) {
        requestHeaders["Upstash-Delay"] = delay;
      }
      if (retries !== undefined) {
        requestHeaders["Upstash-Retries"] = retries.toString();
      }
      if (callback) {
        requestHeaders["Upstash-Callback"] = callback;
      }
      if (failureCallback) {
        requestHeaders["Upstash-Failure-Callback"] = failureCallback;
      }
      if (timeout) {
        requestHeaders["Upstash-Timeout"] = timeout;
      }
      if (queueName) {
        requestHeaders["Upstash-Queue-Name"] = queueName;
      }

      // Add flow control headers
      if (flow_control) {
        requestHeaders["Upstash-Flow-Control-Key"] = flow_control.key;
        const value = [
          flow_control.parallelism === undefined
            ? undefined
            : `parallelism=${flow_control.parallelism}`,
          flow_control.rate === undefined ? undefined : `rate=${flow_control.rate}`,
          flow_control.period === undefined ? undefined : `period=${flow_control.period}`,
        ]
          .filter(Boolean)
          .join(",");
        requestHeaders["Upstash-Flow-Control-Value"] = value;
      }

      // Add custom headers
      if (extraHeaders) {
        for (const [key, value] of Object.entries(extraHeaders)) {
          requestHeaders[key] = value;
        }
      }

      const response = await client.post<{ messageId: string }>(
        `v2/publish/${destination}`,
        body || {},
        requestHeaders
      );

      return [
        "Message published successfully",
        `Message ID: ${response.messageId}`,
        json(response),
      ];
    },
  }),

  qstash_logs_list: tool({
    description: `List QStash logs with optional filtering. Returns a paginated list of message logs without their bodies.`,
    inputSchema: z.object({
      cursor: z.string().optional().describe("Cursor for pagination"),
      messageId: z.string().optional().describe("Filter logs by message ID"),
      state: z
        .enum([
          "CREATED",
          "ACTIVE",
          "RETRY",
          "ERROR",
          "IN_PROGRESS",
          "DELIVERED",
          "FAILED",
          "CANCEL_REQUESTED",
          "CANCELLED",
        ])
        .optional()
        .describe("Filter logs by state"),
      url: z.string().optional().describe("Filter logs by URL"),
      topicName: z.string().optional().describe("Filter logs by topic name"),
      scheduleId: z.string().optional().describe("Filter logs by schedule ID"),
      queueName: z.string().optional().describe("Filter logs by queue name"),
      fromDate: z
        .number()
        .optional()
        .describe("Filter logs from date (Unix timestamp in milliseconds)"),
      toDate: z
        .number()
        .optional()
        .describe("Filter logs to date (Unix timestamp in milliseconds)"),
      count: z.number().max(1000).optional().describe("Number of logs to return (max 1000)"),
      ...qstashCreds,
    }),
    handler: async (params) => {
      const client = await createQStashClientWithToken(params.qstash_creds);

      const response = await client.get<QStashLogsResponse>("v2/logs", {
        trimBody: 0,
        groupBy: "messageId",
        ...params,
      });
      const firstMessageFields = Object.fromEntries(
        Object.entries(response.messages[0] ?? {}).filter(
          ([key, _value]) => !key.toLocaleLowerCase().includes("headers")
        )
      );

      const cleanedEvents = response.messages.map((message) => ({
        messageId: message.messageId,
        events: message.events.map((event) => ({
          state: event.state,
          time: event.time,
        })),
      }));

      return [
        `Found ${response.messages.length} log entries`,
        response.cursor ? `Pagination cursor: ${response.cursor}` : "No more entries",
        json({ ...firstMessageFields, events: cleanedEvents }),
      ];
    },
  }),

  qstash_logs_get: tool({
    description: `Get details of a single QStash log item by message ID without trimming the body.`,
    inputSchema: z.object({
      messageId: z.string().describe("The message ID to get details for"),
      ...qstashCreds,
    }),
    handler: async ({ messageId, qstash_creds }) => {
      const client = await createQStashClientWithToken(qstash_creds);
      const response = await client.get<QStashLogsResponse>("v2/logs", { messageId });

      if (response.messages.length === 0) {
        return "No log entry found for the specified message ID";
      }

      const logEntry = response.messages[0];
      return [`Log details for message ID: ${messageId}`, json(logEntry)];
    },
  }),

  qstash_dlq_list: tool({
    description: `List messages in the QStash Dead Letter Queue (DLQ) with optional filtering.`,
    inputSchema: z.object({
      cursor: z.string().optional().describe("Cursor for pagination"),
      messageId: z.string().optional().describe("Filter DLQ messages by message ID"),
      url: z.string().optional().describe("Filter DLQ messages by URL"),
      topicName: z.string().optional().describe("Filter DLQ messages by topic name"),
      scheduleId: z.string().optional().describe("Filter DLQ messages by schedule ID"),
      queueName: z.string().optional().describe("Filter DLQ messages by queue name"),
      fromDate: z.number().optional().describe("Filter from date (Unix timestamp in milliseconds)"),
      toDate: z.number().optional().describe("Filter to date (Unix timestamp in milliseconds)"),
      responseStatus: z.number().optional().describe("Filter by HTTP response status code"),
      callerIp: z.string().optional().describe("Filter by IP address of the publisher"),
      count: z.number().max(100).optional().describe("Number of messages to return (max 100)"),
      ...qstashCreds,
    }),
    handler: async (params) => {
      const client = await createQStashClientWithToken(params.qstash_creds);

      const response = await client.get<QStashDLQResponse>("v2/dlq", {
        trimBody: 0,
        ...params,
      });

      return [
        `Found ${response.messages.length} DLQ messages`,
        response.cursor ? `Pagination cursor: ${response.cursor}` : "No more entries",
        json(response.messages),
      ];
    },
  }),

  qstash_dlq_get: tool({
    description: `Get details of a single DLQ message by DLQ ID.`,
    inputSchema: z.object({
      dlqId: z.string().describe("The DLQ ID of the message to retrieve"),
      ...qstashCreds,
    }),
    handler: async ({ dlqId, qstash_creds }) => {
      const client = await createQStashClientWithToken(qstash_creds);
      const message = await client.get<QStashDLQMessage>(`v2/dlq/${dlqId}`);

      return [`DLQ message details for ID: ${dlqId}`, json(message)];
    },
  }),

  qstash_schedules_list: tool({
    description: `List all QStash schedules.`,
    handler: async ({ qstash_creds }) => {
      const client = await createQStashClientWithToken(qstash_creds);
      const schedules = await client.get<QStashSchedule[]>("v2/schedules");

      return [`Found ${schedules.length} schedules`, json(schedules)];
    },
  }),

  qstash_schedules_manage: tool({
    description: `Create, update, or manage QStash schedules. This tool handles create, update (by providing scheduleId), pause, resume, and delete operations in one unified interface.`,
    inputSchema: z.object({
      operation: z
        .enum(["create", "update", "pause", "resume", "delete"])
        .describe("The operation to perform"),
      scheduleId: z
        .string()
        .optional()
        .describe("Schedule ID (required for update, pause, resume, delete operations)"),
      destination: z
        .string()
        .optional()
        .describe("Destination URL or topic name (required for create/update)"),
      cron: z.string().optional().describe("Cron expression (required for create/update)"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
        .optional()
        .describe("HTTP method (optional, defaults to POST)"),
      headers: z.record(z.string()).optional().describe("Request headers as key-value pairs"),
      body: z.string().optional().describe("Request body"),
      delay: z
        .string()
        .optional()
        .describe("Delay before message delivery (e.g., '10s', '5m', '1h')"),
      retries: z.number().optional().describe("Number of retries on failure"),
      callback: z.string().optional().describe("Callback URL for successful delivery"),
      failureCallback: z.string().optional().describe("Callback URL for failed delivery"),
      timeout: z.string().optional().describe("Request timeout (e.g., '30s')"),
      queueName: z.string().optional().describe("Queue name to use"),
      ...qstashCreds,
    }),
    handler: async ({
      operation,
      scheduleId,
      destination,
      cron,
      method = "POST",
      headers,
      body,
      delay,
      retries,
      callback,
      failureCallback,
      timeout,
      queueName,
      qstash_creds,
    }) => {
      const client = await createQStashClientWithToken(qstash_creds);

      switch (operation) {
        case "create":
        case "update": {
          if (!destination || !cron) {
            throw new Error("destination and cron are required for create/update operations");
          }

          const requestHeaders: Record<string, string> = {
            "Upstash-Cron": cron,
          };

          if (method !== "POST") {
            requestHeaders["Upstash-Method"] = method;
          }
          if (delay) {
            requestHeaders["Upstash-Delay"] = delay;
          }
          if (retries !== undefined) {
            requestHeaders["Upstash-Retries"] = retries.toString();
          }
          if (callback) {
            requestHeaders["Upstash-Callback"] = callback;
          }
          if (failureCallback) {
            requestHeaders["Upstash-Failure-Callback"] = failureCallback;
          }
          if (timeout) {
            requestHeaders["Upstash-Timeout"] = timeout;
          }
          if (queueName) {
            requestHeaders["Upstash-Queue-Name"] = queueName;
          }
          if (scheduleId && operation === "update") {
            requestHeaders["Upstash-Schedule-Id"] = scheduleId;
          }

          // Add custom headers
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              requestHeaders[key] = value;
            }
          }

          const response = await client.post<QStashScheduleCreateResponse>(
            `v2/schedules/${destination}`,
            body || {},
            requestHeaders
          );

          return [
            operation === "create"
              ? "Schedule created successfully"
              : "Schedule updated successfully",
            `Schedule ID: ${response.scheduleId}`,
            json(response),
          ];
        }

        case "pause": {
          if (!scheduleId) {
            throw new Error("scheduleId is required for pause operation");
          }

          await client.post(`v2/schedules/${scheduleId}/pause`);
          return `Schedule ${scheduleId} paused successfully`;
        }

        case "resume": {
          if (!scheduleId) {
            throw new Error("scheduleId is required for resume operation");
          }

          await client.post(`v2/schedules/${scheduleId}/resume`);
          return `Schedule ${scheduleId} resumed successfully`;
        }

        case "delete": {
          if (!scheduleId) {
            throw new Error("scheduleId is required for delete operation");
          }

          await client.delete(`v2/schedules/${scheduleId}`);
          return `Schedule ${scheduleId} deleted successfully`;
        }

        default: {
          throw new Error(`Unknown operation: ${operation}`);
        }
      }
    },
  }),
};
