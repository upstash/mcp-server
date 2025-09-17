// QStash API Types

export interface QStashUser {
  email: string;
  maxDailyRequests: number;
  maxBurstRequests: number;
  currentDailyRequestCount: number;
  currentBurstRequestCount: number;
  token: string;
  url: string;
}

export interface QStashLog {
  time: number;
  messageId: string;
  header: Record<string, string[]>;
  body: string;
  state:
    | "CREATED"
    | "ACTIVE"
    | "RETRY"
    | "ERROR"
    | "IN_PROGRESS"
    | "DELIVERED"
    | "FAILED"
    | "CANCEL_REQUESTED"
    | "CANCELLED";
  error?: string;
  nextDeliveryTime?: number;
  url?: string;
  topicName?: string;
  endpointName?: string;
  scheduleId?: string;
  queueName?: string;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string[]>;
  timeout?: number;
  method?: string;
  callback?: string;
  callbackHeaders?: Record<string, string[]>;
  failureCallback?: string;
  failureCallbackHeaders?: Record<string, string[]>;
  maxRetries?: number;
}

export interface QStashLogsResponse {
  cursor?: string;
  messages: {
    messageId: string;
    events: QStashLog[];
  }[];
}

export interface QStashDLQMessage {
  messageId: string;
  topicId?: string;
  url: string;
  method: string;
  header: Record<string, string[]>;
  body: string;
  createdAt: number;
  state: string;
}

export interface QStashDLQResponse {
  cursor?: string;
  messages: QStashDLQMessage[];
}

export interface QStashSchedule {
  scheduleId: string;
  createdAt: number;
  cron: string;
  destination: string;
  method: string;
  header: Record<string, string[]>;
  body: string;
  retries?: number;
  delay?: number;
  callback?: string;
  isPaused?: boolean;
}

export interface QStashScheduleCreateResponse {
  scheduleId: string;
}

// Workflow API Types

export interface WorkflowLog {
  workflowRunId: string;
  workflowUrl: string;
  workflowState: "RUN_STARTED" | "RUN_SUCCESS" | "RUN_FAILED" | "RUN_CANCELED";
  workflowRunCreatedAt: number;
  workflowRunCompletedAt?: number;
  steps: Array<{
    steps: Array<{
      stepId?: number;
      stepName: string;
      stepType: string;
      callType: string;
      messageId: string;
      out?: string;
      concurrent: number;
      state: string;
      createdAt: number;
    }>;
    type: "sequential" | "parallel";
  }>;
}

export interface WorkflowLogsResponse {
  cursor?: string;
  runs: WorkflowLog[];
}

export interface WorkflowMessageLog {
  time: number;
  state: string;
  workflowRunId: string;
  workflowUrl: string;
  workflowCreatedAt: number;
  stepInfo?: {
    stepName: string;
    stepType: string;
    callType: string;
    messageId: string;
    concurrent: number;
    createdAt: number;
  };
  nextDeliveryTime?: number;
}

export interface WorkflowMessageLogsResponse {
  cursor?: string;
  events: WorkflowMessageLog[];
}

export interface WorkflowDLQMessage {
  messageId: string;
  url: string;
  method: string;
  header: Record<string, string[]>;
  body?: string;
  bodyBase64?: string;
  maxRetries: number;
  notBefore: number;
  createdAt: number;
  failureCallback?: string;
  failureCallbackHeader?: Record<string, string[]>;
  callerIP: string;
  workflowRunId: string;
  workflowCreatedAt: number;
  workflowUrl: string;
  flowControlKey?: string;
  rate?: number;
  parallelism?: number;
  period?: number;
  responseStatus: number;
  responseHeader: Record<string, string[]>;
  responseBody: string;
  responseBodyBase64?: string;
  failureCallbackInfo?: {
    state: string;
    responseBody: string;
    responseStatus: number;
    responseHeader: Record<string, string[]>;
  };
  dlqId: string;
}

export interface WorkflowDLQResponse {
  cursor?: string;
  messages: WorkflowDLQMessage[];
}
