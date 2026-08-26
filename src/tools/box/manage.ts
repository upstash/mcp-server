import { z } from "zod";
import { json, tool } from "../helpers";
import { buildBoxCommon } from "./common";
import { getBoxClient } from "./utils";
type BoxRef = { id: string; status: string };

/** Fields a create call may carry; everything is optional at the wire level. */
export type CreateBoxParams = {
  name?: string;
  model?: string;
  agent?: string;
  runtime?: string;
  agent_api_key?: string;
  env_vars?: Record<string, string>;
  clone_repo?: string;
  clone_token?: string;
  ephemeral?: boolean;
  ttl?: number;
  size?: string;
  keep_alive?: boolean;
  init_command?: string;
  labels?: string[];
  git_user_name?: string;
  git_user_email?: string;
  network_policy?: {
    mode: "allow-all" | "deny-all" | "custom";
    allowed_domains?: string[];
    allowed_cidrs?: string[];
    denied_cidrs?: string[];
  };
};

/**
 * Directory a clone will land in, derived from the repository URL.
 *
 * The clone is placed in a subdirectory of the workspace named after the repo,
 * while every git tool defaults to the workspace root, so callers that are not
 * told this have to go looking for it.
 *
 * Mirrors the agent's own ExtractRepoName, including its order: the trailing
 * slash comes off before `.git`, so "repo.git/" resolves to "repo" rather than
 * "repo.git".
 * @param repo - the clone_repo URL, if one was given.
 * @returns the directory name, or undefined when there is nothing to clone.
 */
export function clonedRepoDir(repo?: string): string | undefined {
  if (repo === undefined || repo === "") return undefined;
  const trimmed = repo
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  const name = trimmed.split("/").pop();
  return name === undefined || name === "" ? undefined : name;
}

/**
 * Build the create-box request body from the fields the caller set.
 *
 * Exported for unit tests: the exact JSON matters more than it looks. A present
 * but empty `agent` starts an agent box, and the domain/CIDR lists are only
 * meaningful for a custom network policy.
 */
export function buildCreateBody(params: CreateBoxParams): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const copy = <K extends keyof CreateBoxParams>(key: K) => {
    const value = params[key];
    if (value !== undefined && value !== "") body[key] = value;
  };

  copy("name");
  copy("model");
  copy("agent");
  copy("runtime");
  copy("agent_api_key");
  copy("clone_repo");
  copy("clone_token");
  copy("size");
  copy("init_command");
  copy("git_user_name");
  copy("git_user_email");
  if (params.env_vars !== undefined) body.env_vars = params.env_vars;
  if (params.labels !== undefined) body.labels = params.labels;
  if (params.ephemeral !== undefined) body.ephemeral = params.ephemeral;
  if (params.keep_alive !== undefined) body.keep_alive = params.keep_alive;
  if (params.ttl !== undefined) body.ttl = params.ttl;
  if (params.network_policy !== undefined) {
    const policy = params.network_policy;
    body.network_policy =
      policy.mode === "custom"
        ? {
            mode: policy.mode,
            allowed_domains: policy.allowed_domains,
            allowed_cidrs: policy.allowed_cidrs,
            denied_cidrs: policy.denied_cidrs,
          }
        : { mode: policy.mode };
  }
  return body;
}

export const boxManageTool = {
  box_manage: tool({
    description: `Manage Upstash Box containers: create, list, get, delete, pause, resume, fork. A box is an isolated cloud Linux container with its own filesystem, reached only through the box tools. Keep the returned box_id and reuse it for every later call in the task.

By default a box runs NO agent — it is a plain remote workspace you drive yourself with box_exec, box_git and the box file tools. That is the normal case for using a box as a workspace. Only set 'agent' when you want an AI agent (Claude Code, Codex, opencode) running inside the box, which also requires 'model'.

A box without keep_alive is paused automatically after it goes idle (1 hour on the Free plan, 6 hours on paid). Every box tool call counts as activity and resets that timer, and a paused box resumes automatically on the next call.

Creating is not instant, and 'clone_repo' finishes even later:
1. create returns immediately with status 'creating' — file and exec calls fail until the container exists, so poll with action 'get' until the status is 'idle'.
2. The clone only STARTS once the box reports idle, so an idle box can still have an empty workspace. After that, poll box_list until the repository directory appears — do not use box_git status to check, because an empty status means 'no changes' AND 'not a repository'.
3. A clone that fails leaves a working but EMPTY box — create still reported success. If the workspace stays empty, run box_git clone yourself and read the error.
Use a non-ephemeral box when you pass clone_repo; ephemeral creation takes a different path that may skip the clone.`,
    get inputSchema() {
      return z
        .object({
          action: z
            .enum(["create", "list", "get", "delete", "pause", "resume", "fork"])
            .describe("The action to perform"),
          box_id: z
            .string()
            .optional()
            .describe("Box ID (required for get, delete, pause, resume, fork)"),
          // Create-specific fields
          name: z.string().optional().describe("Display name for the box"),
          model: z
            .string()
            .optional()
            .describe(
              "LLM model for the in-box agent (e.g. 'claude/sonnet_4_6', 'openai/o4-mini'). Required only when 'agent' is set; leave unset for a plain workspace box"
            ),
          agent: z
            .enum(["claude-code", "codex", "opencode"])
            .optional()
            .describe(
              "Run an AI agent inside the box. Omit for a plain workspace box with no agent (the normal case)"
            ),
          runtime: z
            .string()
            .optional()
            .default("node")
            .describe("Runtime environment (e.g. 'node', 'python')"),
          agent_api_key: z
            .string()
            .optional()
            .describe("API key for the AI agent provider. Empty uses managed key"),
          env_vars: z
            .record(z.string(), z.string())
            .optional()
            .describe("Environment variables to set in the box"),
          clone_repo: z.string().optional().describe("Git repository URL to clone into the box"),
          clone_token: z.string().optional().describe("Token for cloning private repositories"),
          ephemeral: z.boolean().optional().describe("If true, box auto-deletes after TTL expires"),
          ttl: z
            .number()
            .optional()
            .describe("Time-to-live in seconds for ephemeral boxes (max 259200 = 3 days)"),
          size: z
            .enum(["small", "medium", "large"])
            .optional()
            .describe(
              "Resources: small = 2 CPU / 4 GB, medium = 4 / 8, large = 8 / 16 (default: small)"
            ),
          keep_alive: z
            .boolean()
            .optional()
            .describe(
              "Never auto-pause this box. Paid (PAYG) plans only, and cannot be combined with 'ephemeral'. Required if you pass 'init_command'"
            ),
          init_command: z
            .string()
            .optional()
            .describe(
              "Shell command run once when the box starts. Requires keep_alive=true. For one-off setup on a normal box, run box_exec instead"
            ),
          labels: z
            .array(z.string().max(20))
            .max(5)
            .optional()
            .describe("Labels for organizing boxes (max 5, each up to 20 characters)"),
          git_user_name: z
            .string()
            .optional()
            .describe("git user.name used for commits in the box"),
          git_user_email: z
            .string()
            .optional()
            .describe("git user.email used for commits in the box"),
          network_policy: z
            .object({
              mode: z
                .enum(["allow-all", "deny-all", "custom"])
                .describe("allow-all (default), deny-all, or custom to use the lists below"),
              allowed_domains: z.array(z.string()).optional(),
              allowed_cidrs: z.array(z.string()).optional(),
              denied_cidrs: z.array(z.string()).optional(),
            })
            .optional()
            .describe(
              "Outbound network policy. The domain/CIDR lists apply only when mode is 'custom'"
            ),
          // List-specific fields
          status: z
            .enum(["active", "deleted"])
            .optional()
            .describe("Filter for list action: 'active' (default) or 'deleted'"),
          ...buildBoxCommon(),
        })
        .superRefine((value, ctx) => {
          if (value.action !== "create") return;
          // Server-side rules, enforced here so a mistake is a schema error with a
          // fix in it rather than a 400 the model retries blindly.
          if (value.keep_alive && value.ephemeral) {
            ctx.addIssue({
              code: "custom",
              path: ["keep_alive"],
              message: "keep_alive and ephemeral are mutually exclusive; pick one",
            });
          }
          if (value.init_command !== undefined && !value.keep_alive) {
            ctx.addIssue({
              code: "custom",
              path: ["init_command"],
              message:
                "init_command requires keep_alive=true. For one-off setup on a normal box, run box_exec after create instead",
            });
          }
          if (value.agent !== undefined && !value.model) {
            ctx.addIssue({
              code: "custom",
              path: ["model"],
              message: "model is required when agent is set; omit both for a plain workspace box",
            });
          }
        });
    },
    handler: async (params) => {
      const { action, box_id } = params;
      const client = getBoxClient(params);

      switch (action) {
        case "create": {
          // Only fields the caller actually set are posted. An empty `agent` is
          // the no-agent case, and the API reads that from the key being absent,
          // not from an empty string.
          const body = buildCreateBody(params);
          const box = await client.post<BoxRef>("v2/box", body);
          const lines = [`Box created successfully (status: ${box.status})`, `Box ID: ${box.id}`];
          const cloneDir = clonedRepoDir(params.clone_repo);
          if (cloneDir !== undefined) {
            // Saying where the clone lands stops the model from having to
            // discover it: git tools default to the workspace root, not here.
            lines.push(
              `The repository will be cloned to '${cloneDir}' inside the workspace. Pass folder='${cloneDir}' to box_git, and wait for it to appear (box_list) before reading files.`
            );
          }
          lines.push(json(box));
          return lines;
        }

        case "list": {
          const query: Record<string, string | undefined> = {};
          if (params.status === "deleted") query.status = "deleted";
          const boxes = await client.get<unknown[]>("v2/box", query);
          return [`Found ${boxes.length} boxes`, json(boxes)];
        }

        case "get": {
          if (!box_id) throw new Error("box_id is required for get action");
          const box = await client.get<BoxRef>(`v2/box/${box_id}`);
          return [`Box ${box_id} (status: ${box.status})`, json(box)];
        }

        case "delete": {
          if (!box_id) throw new Error("box_id is required for delete action");
          await client.delete(`v2/box/${box_id}`);
          return `Box ${box_id} deleted successfully`;
        }

        case "pause": {
          if (!box_id) throw new Error("box_id is required for pause action");
          await client.post(`v2/box/${box_id}/pause`);
          return `Box ${box_id} paused successfully`;
        }

        case "resume": {
          if (!box_id) throw new Error("box_id is required for resume action");
          await client.post(`v2/box/${box_id}/resume`);
          return `Box ${box_id} resumed successfully`;
        }

        case "fork": {
          if (!box_id) throw new Error("box_id is required for fork action");
          const forked = await client.post<BoxRef>(`v2/box/${box_id}/fork`);
          return [`Box forked successfully`, `New Box ID: ${forked.id}`, json(forked)];
        }

        default: {
          throw new Error(`Unknown action: ${action}`);
        }
      }
    },
  }),
};
