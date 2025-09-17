import { z } from "zod";
import { json, tool } from "..";
import { createQStashClientWithToken } from "./utils";
import type { WorkflowLogsResponse, WorkflowDLQResponse, WorkflowDLQMessage } from "./types";
import { qstashCreds } from "./qstash";

export const workflowTools = {
  workflow_logs_list: tool({
    description: `List Upstash Workflow logs with optional filtering. Returns grouped workflow runs with their execution details.`,
    inputSchema: z.object({
      cursor: z.string().optional().describe("Cursor for pagination"),
      workflowRunId: z.string().optional().describe("Filter by specific workflow run ID"),
      count: z.number().optional().describe("Number of workflow runs to return"),
      state: z
        .enum(["RUN_STARTED", "RUN_SUCCESS", "RUN_FAILED", "RUN_CANCELED"])
        .optional()
        .describe("Filter by workflow state"),
      workflowUrl: z.string().optional().describe("Filter by workflow URL (exact match)"),
      workflowCreatedAt: z
        .number()
        .optional()
        .describe("Filter by workflow creation timestamp (Unix timestamp)"),
      ...qstashCreds,
    }),
    handler: async (params) => {
      const client = await createQStashClientWithToken(params.qstash_creds);

      const response = await client.get<WorkflowLogsResponse>("v2/workflows/events", {
        trimBody: 0,
        groupBy: "workflowRunId",
        ...params,
      });

      const cleaned = response.runs.map((run) =>
        Object.fromEntries(Object.entries(run).filter(([key, _value]) => key !== "steps"))
      );

      return [
        `Found ${response.runs.length} workflow runs`,
        response.cursor ? `Pagination cursor: ${response.cursor}` : "No more entries",
        json({
          ...response,
          runs: cleaned,
        }),
      ];
    },
  }),

  workflow_logs_get: tool({
    description: `Get details of a single workflow run by workflow run ID. There
    could be multiple workflow runs with the same workflow run ID, so you can
    use the workflowCreatedAt to get the details of the specific workflow run.`,
    inputSchema: z.object({
      workflowRunId: z.string().describe("The workflow run ID to get details for"),
      workflowCreatedAt: z
        .number()
        .optional()
        .describe("The workflow creation timestamp (Unix timestamp)"),
      ...qstashCreds,
    }),
    handler: async (params) => {
      const client = await createQStashClientWithToken(params.qstash_creds);
      const response = await client.get<WorkflowLogsResponse>("v2/workflows/logs", {
        ...params,
      });

      if (response.runs.length === 0) {
        return "No workflow run found";
      }

      const workflowRun = response.runs[0];
      return [
        `Workflow run details for ID: ${params.workflowRunId} created at: ${params.workflowCreatedAt}`,
        json(workflowRun),
      ];
    },
  }),

  workflow_dlq_list: tool({
    description: `List failed workflow runs in the Dead Letter Queue (DLQ) with optional filtering.`,
    inputSchema: z.object({
      cursor: z.string().optional().describe("Cursor for pagination"),
      workflowRunId: z.string().optional().describe("Filter by workflow run ID"),
      workflowUrl: z.string().optional().describe("Filter by workflow URL"),
      fromDate: z.number().optional().describe("Filter from date (Unix timestamp in milliseconds)"),
      toDate: z.number().optional().describe("Filter to date (Unix timestamp in milliseconds)"),
      responseStatus: z.number().optional().describe("Filter by HTTP response status code"),
      callerIP: z.string().optional().describe("Filter by IP address of the caller"),
      failureCallbackState: z.string().optional().describe("Filter by failure callback state"),
      count: z.number().optional().describe("Number of DLQ messages to return"),
      ...qstashCreds,
    }),
    handler: async (params) => {
      const client = await createQStashClientWithToken(params.qstash_creds);

      const response = await client.get<WorkflowDLQResponse>("v2/workflows/dlq", {
        ...params,
        trimBody: 0,
      });

      const cleaned = response.messages.map((message) =>
        Object.fromEntries(Object.entries(message).filter(([key]) => !key.includes("header")))
      );

      return [
        `Found ${response.messages.length} failed workflow runs in DLQ`,
        response.cursor ? `Pagination cursor: ${response.cursor}` : "No more entries",
        json({
          ...response,
          messages: cleaned,
        }),
      ];
    },
  }),

  workflow_dlq_get: tool({
    description: `Get details of a single failed workflow run from the DLQ by DLQ ID.`,
    inputSchema: z.object({
      dlqId: z.string().describe("The DLQ ID of the failed workflow run to retrieve"),
      ...qstashCreds,
    }),
    handler: async (params) => {
      const client = await createQStashClientWithToken(params.qstash_creds);
      const message = await client.get<WorkflowDLQMessage>(`v2/workflows/dlq/${params.dlqId}`);

      return [`Failed workflow run details for DLQ ID: ${params.dlqId}`, json(message)];
    },
  }),

  workflow_dlq_manage: tool({
    description: `Delete, restart, and resume failed workflow runs in the DLQ using only the DLQ ID.`,
    inputSchema: z.object({
      dlqId: z.string().describe("The DLQ ID of the failed workflow run"),
      action: z
        .enum(["delete", "restart", "resume"])
        .describe(
          "The action to perform: delete (remove from DLQ), restart (from beginning), or resume (from the failed step)"
        ),
      ...qstashCreds,
    }),
    handler: async ({ dlqId, action, qstash_creds }) => {
      const client = await createQStashClientWithToken(qstash_creds);

      switch (action) {
        case "delete": {
          await client.delete(`v2/workflows/dlq/delete/${dlqId}`);
          return `Failed workflow run with DLQ ID ${dlqId} deleted successfully`;
        }

        case "restart": {
          const restartResponse = await client.post(`v2/workflows/dlq/restart/${dlqId}`);
          return [
            `Workflow run restarted successfully from DLQ ID: ${dlqId}`,
            json(restartResponse),
          ];
        }

        case "resume": {
          const resumeResponse = await client.post(`v2/workflows/dlq/resume/${dlqId}`);
          return [`Workflow run resumed successfully from DLQ ID: ${dlqId}`, json(resumeResponse)];
        }

        default: {
          throw new Error(
            `Invalid action: ${action}. Supported actions are: delete, restart, resume`
          );
        }
      }
    },
  }),
};
