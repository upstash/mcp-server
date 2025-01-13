export type RedisDatabase = {
  database_id: string;
  database_name: string;
  database_type: string;
  region: string;
  type: string;
  primary_members: string[];
  all_members: string[];
  primary_region: string;
  read_regions: string[];
  port: number;
  creation_time: string;
  budget: number;
  state: string;
  password: string;
  user_email: string;
  endpoint: string;
  tls: boolean;
  eviction: boolean;
  auto_upgrade: boolean;
  consistent: boolean;
  reserved_per_region_price: number;
  modifying_state: string;
  rest_token: string;
  read_only_rest_token: string;
  db_max_clients: number;
  db_max_request_size: number;
  db_resource_size: string;
  db_type: string;
  db_disk_threshold: number;
  db_max_entry_size: number;
  db_memory_threshold: number;
  db_conn_idle_timeout: number;
  db_lua_timeout: number;
  db_lua_credits_per_min: number;
  db_store_max_idle: number;
  db_max_loads_per_sec: number;
  db_max_commands_per_second: number;
  db_request_limit: number;
  db_acl_enabled: string;
  db_acl_default_user_status: string;
};

export type RedisBackup = {
  backup_id: string;
  database_id: string;
  name: string;
  creation_time: number;
  state: string;
  backup_size: number;
  daily_backup: boolean;
  hourly_backup: boolean;
};

export type UsageData = { x: string; y: number }[];

export type RedisUsageResponse = {
  read_latency_mean: UsageData;
  write_latency_mean: UsageData;
  keyspace: UsageData;
  throughput: UsageData;
  daily_net_commands: number;
  diskusage: UsageData;
  command_counts: {
    metric_identifier: string;
    data_points: UsageData;
  }[];

  // For last 5 days
  dailyrequests: UsageData;
  bandwidths: UsageData;
  days: string[];
};
