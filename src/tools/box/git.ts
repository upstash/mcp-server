import { z } from "zod";
import { json, tool } from "../helpers";
import { buildBoxCommon } from "./common";
import { getBoxClient } from "./utils";

type GitExecResponse = { output?: string; error?: string; exit_code?: number };
type CreatePRResponse = { url?: string };

export const boxGitTool = {
  box_git: tool({
    description: `Run git operations inside an Upstash Box. Operates on the repository INSIDE the box, not your local checkout — a local git command in Bash would act on a different repository.

Actions: clone, status, diff, commit, checkout, push, create_pr, exec.

'exec' is also the search path for a box: pass git arguments WITHOUT the leading 'git', e.g. args ["grep","-n","TODO"] to search tracked files, or args ["ls-files"] to list them. Both respect .gitignore, which plain find/grep do not.

IMPORTANT: 'folder' defaults to the workspace root, which is usually NOT the repository. A cloned repo sits in a subdirectory named after it (cloning github.com/octocat/Hello-World gives 'Hello-World'), so pass that as 'folder' for every action. Use box_list to see it if you are unsure.`,
    get inputSchema() {
      return z.object({
        action: z
          .enum(["clone", "status", "diff", "commit", "checkout", "push", "create_pr", "exec"])
          .describe("The git operation to perform"),
        box_id: z.string().describe("The box holding the repository"),
        folder: z
          .string()
          .optional()
          .describe("Repository directory inside the box (defaults to the workspace root)"),
        // clone
        repo: z.string().optional().describe("Repository URL to clone (action: clone)"),
        branch: z
          .string()
          .optional()
          .describe("Branch to clone, check out, or push (actions: clone, checkout, push)"),
        depth: z.number().int().optional().describe("Shallow clone depth (action: clone)"),
        github_token: z
          .string()
          .optional()
          .describe("Token for cloning a private repository (action: clone)"),
        // commit
        message: z.string().optional().describe("Commit message (action: commit)"),
        author_name: z.string().optional().describe("Commit author name (action: commit)"),
        author_email: z.string().optional().describe("Commit author email (action: commit)"),
        // create_pr
        title: z.string().optional().describe("Pull request title (action: create_pr)"),
        body: z.string().optional().describe("Pull request body (action: create_pr)"),
        base: z.string().optional().describe("Base branch for the PR (action: create_pr)"),
        // exec
        args: z
          .array(z.string())
          .optional()
          .describe("git arguments without the leading 'git' (action: exec)"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { action, box_id, folder } = params;
      const client = getBoxClient(params);
      const base = `v2/box/${box_id}/git`;
      const withFolder = (body: Record<string, unknown>) =>
        folder === undefined ? body : { ...body, folder };

      switch (action) {
        case "clone": {
          if (!params.repo) throw new Error("repo is required for clone");
          const body: Record<string, unknown> = { repo: params.repo };
          if (params.branch !== undefined) body.branch = params.branch;
          if (params.depth !== undefined) body.depth = params.depth;
          if (params.github_token !== undefined) body.github_token = params.github_token;
          const result = await client.post(`${base}/clone`, withFolder(body));
          return [`Cloned ${params.repo}`, json(result)];
        }

        case "status": {
          const query = folder === undefined ? {} : { folder };
          const status = await client.get<{ status?: string }>(`${base}/status`, query);
          // git status --porcelain prints nothing for a clean tree AND the
          // server does not surface git's exit 128, so an empty result cannot
          // tell "no changes" apart from "not a repository".
          if ((status.status ?? "") === "" && folder === undefined) {
            return [
              "Empty status. This ran in the workspace root with no 'folder', so it means either a clean tree or no repository there at all — pass the repository subdirectory to be sure (box_list shows it).",
              json(status),
            ];
          }
          return json(status);
        }

        case "diff": {
          const query = folder === undefined ? {} : { folder };
          return json(await client.get(`${base}/diff`, query));
        }

        case "commit": {
          if (!params.message) throw new Error("message is required for commit");
          const body: Record<string, unknown> = { message: params.message };
          if (params.author_name !== undefined) body.author_name = params.author_name;
          if (params.author_email !== undefined) body.author_email = params.author_email;
          return json(await client.post(`${base}/commit`, withFolder(body)));
        }

        case "checkout": {
          if (!params.branch) throw new Error("branch is required for checkout");
          // The server switches to the branch and creates it when it does not
          // exist. It discovers that by letting the plain checkout fail with
          // stderr suppressed, so a genuine failure (dirty tree, bad ref) also
          // lands on the create path and comes back as a new branch.
          const result = await client.post(
            `${base}/checkout`,
            withFolder({ branch: params.branch })
          );
          return [`Checked out ${params.branch} (created if it did not exist)`, json(result)];
        }

        case "push": {
          const body: Record<string, unknown> = {};
          if (params.branch !== undefined) body.branch = params.branch;
          return json(await client.post(`${base}/push`, withFolder(body)));
        }

        case "create_pr": {
          if (!params.title) throw new Error("title is required for create_pr");
          const body: Record<string, unknown> = { title: params.title };
          if (params.body !== undefined) body.body = params.body;
          if (params.base !== undefined) body.base = params.base;
          const pr = await client.post<CreatePRResponse>(`${base}/create-pr`, withFolder(body));
          return [pr.url ? `Pull request created: ${pr.url}` : "Pull request created", json(pr)];
        }

        case "exec": {
          if (!params.args || params.args.length === 0) {
            throw new Error("args is required for exec, without the leading 'git'");
          }
          if (params.args[0] === "git") {
            throw new Error(
              'drop the leading \'git\' from args; the server adds it (use ["status"], not ["git","status"])'
            );
          }
          const res = await client.post<GitExecResponse>(
            `${base}/exec`,
            withFolder({ args: params.args })
          );
          const output = [res.output, res.error].filter(Boolean).join("\n").trim();
          if (res.exit_code !== undefined && res.exit_code !== 0) {
            // 128 is git's "not a repository", which here almost always means
            // folder was left at the workspace root instead of the clone.
            const hint =
              res.exit_code === 128 && folder === undefined
                ? " — no 'folder' was given, so this ran in the workspace root; pass the repository subdirectory (box_list shows it)"
                : "";
            return [`git ${params.args.join(" ")} exited ${res.exit_code}${hint}`, output];
          }
          return output.length > 0 ? output : `git ${params.args.join(" ")} produced no output`;
        }

        default: {
          throw new Error(`Unknown action: ${String(action)}`);
        }
      }
    },
  }),
};
