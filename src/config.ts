export const config = {
  apiKey: "",
  email: "",
  boxApiKey: "",
  disableTelemetry: false,
  readonly: false,
  /** Transport this process is serving; box_upload's exposure depends on it. */
  transport: "stdio" as "stdio" | "http",
  /**
   * Directories box_upload may read from. Empty means "no restriction", which
   * is only safe on stdio, where the server is the user's own process.
   */
  uploadRoots: [] as string[],
};
