export type RedisDatabase = {
  database_id: string;
  database_name: string;
  password: string;
  endpoint: string;
  port: number;
  region: string;
  creation_time: number;
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
