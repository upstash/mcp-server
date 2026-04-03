export interface Box {
  id: string;
  customer_id: string;
  name?: string;
  model: string;
  agent?: string;
  runtime?: string;
  status: string;
  session_id?: string;
  clone_repo?: string;
  ephemeral?: boolean;
  expires_at?: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_prompts: number;
  total_cpu_ns: number;
  total_compute_cost_usd: number;
  total_token_cost_usd: number;
  use_managed_key: boolean;
  mcp_servers?: McpServer[];
  enabled_skills?: string[];
  env_vars?: Record<string, string>;
  network_policy?: NetworkPolicy;
  git_user_name?: string;
  git_user_email?: string;
  last_activity_at?: number;
  created_at: number;
  updated_at: number;
}

export interface McpServer {
  name: string;
  source: string;
  package_or_url: string;
  args?: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface NetworkPolicy {
  mode: string;
  allowed_domains?: string[];
  allowed_cidrs?: string[];
  denied_cidrs?: string[];
}

export interface ExecResponse {
  exit_code: number;
  output: string;
  error?: string;
  cpu_ns?: number;
}

export interface RunResponse {
  run_id?: string;
  output: string;
  metadata?: RunMetadata;
}

export interface RunMetadata {
  input_tokens?: number;
  output_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
}

export interface BoxLogEntry {
  timestamp: number;
  level: string;
  source: string;
  message: string;
}

export interface BoxRun {
  id: string;
  box_id: string;
  type: string;
  status: string;
  prompt?: string;
  model?: string;
  output?: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
  cost_usd: number;
  duration_ms: number;
  cpu_ns?: number;
  compute_cost_usd?: number;
  memory_peak_bytes?: number;
  error_message?: string;
  session_id?: string;
  schedule_id?: string;
  created_at: number;
  completed_at?: number;
}

export interface BoxPreview {
  id: string;
  box_id: string;
  port: number;
  username?: string;
  password?: string;
  token?: string;
  created_at: number;
}

export interface CreatePreviewResponse {
  url: string;
  port: number;
  username?: string;
  password?: string;
  token?: string;
}

export interface BoxSnapshot {
  id: string;
  box_id: string;
  name: string;
  runtime?: string;
  model?: string;
  ephemeral?: boolean;
  size_bytes: number;
  status: string;
  created_at: number;
}
