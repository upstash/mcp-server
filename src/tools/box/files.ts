import { readFile, stat as statLocal } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { json, tool } from "../helpers";
import { buildBoxCommon } from "./common";
import { getBoxClient } from "./utils";

type ReadFileResponse = { content: string };
type FileEntry = { name: string; path: string; size: number; is_dir: boolean; mod_time: string };
/** The list endpoint wraps its result and may return null instead of an empty array. */
type ListFilesResponse = { files: FileEntry[] | null };
type FileStat = {
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  mod_time: string;
  inode: number;
  version: string;
};

/**
 * Shared preamble so every file tool states the boundary.
 *
 * The local Read/Write/Edit tools stay available and look equally applicable, so
 * each description has to say which machine it touches; guidance sent once at
 * initialize is weighted far less than the text attached to a tool.
 */
const IN_THE_BOX =
  "Operates on the filesystem INSIDE the box — your own Read/Write/Edit tools cannot see these files, and they cannot see local files. Relative paths resolve against the box workspace (/workspace/home).";

export const boxFilesTool = {
  box_read: tool({
    description: `Read a file from inside an Upstash Box. ${IN_THE_BOX} Use this instead of the local Read tool when working in a box.

Long results are truncated before you see them, and the truncation is marked. For a large file, read it in chunks with 'offset' and 'length' rather than assuming one call returned all of it.`,
    get inputSchema() {
      return z
        .object({
          box_id: z.string().describe("The box to read from"),
          path: z.string().describe("File path inside the box"),
          offset: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Byte offset to start from. Only meaningful together with 'length'"),
          length: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe(
              "Read only this many bytes (max 8 MiB). OMIT this to read the whole file — passing 0 reads zero bytes, it does not mean 'all'"
            ),
          encoding: z
            .literal("base64")
            .optional()
            .describe("Set to 'base64' for binary files; omit for text"),
          ...buildBoxCommon(),
        })
        .refine((value) => value.offset === undefined || value.length !== undefined, {
          path: ["length"],
          message: "offset only applies to a ranged read; pass 'length' as well, or drop 'offset'",
        });
    },
    handler: async (params) => {
      const { box_id, path, offset, length, encoding } = params;
      const client = getBoxClient(params);

      const res = await client.get<ReadFileResponse>(
        `v2/box/${box_id}/files/read`,
        buildReadQuery({ path, offset, length, encoding })
      );
      return res.content ?? "";
    },
  }),

  box_list: tool({
    description: `List one directory inside an Upstash Box. ${IN_THE_BOX} This lists a single directory; to match a glob or search a repository, use box_git with action 'exec' (git ls-files / git grep).`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box to list in"),
        path: z
          .string()
          .optional()
          .describe("Directory to list, e.g. 'src' (defaults to the workspace root)"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, path } = params;
      const client = getBoxClient(params);
      const res = await client.get<ListFilesResponse>(
        `v2/box/${box_id}/files/list`,
        buildListQuery(path)
      );
      const entries = unwrapFiles(res);
      return [`${entries.length} entries`, json(entries)];
    },
  }),

  box_stat: tool({
    description: `Get metadata for a path inside an Upstash Box (type, size, modification time, inode, and a version token). ${IN_THE_BOX}`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box to inspect"),
        path: z.string().describe("Path inside the box"),
        follow: z
          .boolean()
          .optional()
          .describe("Follow a final symlink (default: report the link itself)"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, path, follow } = params;
      const client = getBoxClient(params);
      const query: Record<string, string | boolean> = { path };
      if (follow !== undefined) query.follow = follow;
      const stat = await client.get<FileStat>(`v2/box/${box_id}/files/stat`, query);
      return json(stat);
    },
  }),

  box_write: tool({
    description: `Write a file inside an Upstash Box, creating or overwriting it. ${IN_THE_BOX} Use this instead of the local Write tool when working in a box.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box to write in"),
        path: z.string().describe("File path inside the box"),
        content: z.string().describe("File content"),
        encoding: z
          .literal("base64")
          .optional()
          .describe("Set to 'base64' when 'content' is base64-encoded binary"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, path, content, encoding } = params;
      const client = getBoxClient(params);
      const body: Record<string, unknown> = { path, content };
      if (encoding !== undefined) body.encoding = encoding;
      await client.post(`v2/box/${box_id}/files/write`, body);
      return `Wrote ${content.length} characters to ${path}`;
    },
  }),

  box_edit: tool({
    description: `Replace an exact string in a file inside an Upstash Box. ${IN_THE_BOX} Fails if the string is missing or appears more than once, so include enough surrounding context to make it unique. Use this instead of the local Edit tool when working in a box.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box holding the file"),
        path: z.string().describe("File path inside the box"),
        old_string: z.string().describe("Exact text to replace; must appear exactly once"),
        new_string: z.string().describe("Replacement text"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, path, old_string, new_string } = params;
      const client = getBoxClient(params);

      const current = await client.get<ReadFileResponse>(`v2/box/${box_id}/files/read`, { path });
      const content = current.content ?? "";
      const { text, message } = applyEdit(content, old_string, new_string, path);
      await client.post(`v2/box/${box_id}/files/write`, { path, content: text });
      return message;
    },
  }),

  box_mkdir: tool({
    description: `Create a directory inside an Upstash Box. ${IN_THE_BOX}`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box to create the directory in"),
        path: z.string().describe("Directory path inside the box"),
        parents: z.boolean().optional().describe("Create missing parents, like mkdir -p"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, path, parents } = params;
      const client = getBoxClient(params);
      const body: Record<string, unknown> = { path };
      if (parents !== undefined) body.parents = parents;
      await client.post(`v2/box/${box_id}/files/mkdir`, body);
      return `Created directory ${path}`;
    },
  }),

  box_rename: tool({
    description: `Move or rename a path inside an Upstash Box. ${IN_THE_BOX}`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box holding the path"),
        from: z.string().describe("Current path"),
        to: z.string().describe("New path"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, from, to } = params;
      const client = getBoxClient(params);
      await client.post(`v2/box/${box_id}/files/rename`, { from, to });
      return `Renamed ${from} to ${to}`;
    },
  }),

  box_remove: tool({
    description: `Delete a file or directory inside an Upstash Box. ${IN_THE_BOX} Removing a directory requires recursive=true.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box holding the path"),
        path: z.string().describe("Path inside the box"),
        recursive: z
          .boolean()
          .optional()
          .describe("Required to remove a directory and everything under it"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, path, recursive } = params;
      const client = getBoxClient(params);
      const body: Record<string, unknown> = { path };
      if (recursive !== undefined) body.recursive = recursive;
      await client.post(`v2/box/${box_id}/files/remove`, body);
      return `Removed ${path}`;
    },
  }),
  box_upload: tool({
    description: `Copy files from YOUR machine into an Upstash Box. This is the one box tool that reads local paths: it takes files that exist on the user's computer and puts them in the box, which is how uncommitted local work gets into a workspace (a clone only brings what is pushed).

Up to 10 files per call, 100 MB each. For content you already have in hand, use box_write instead — this is for files on disk.`,
    get inputSchema() {
      return z.object({
        box_id: z.string().describe("The box to upload into"),
        files: z
          .array(
            z.object({
              local_path: z.string().describe("Absolute path of the file on the user's machine"),
              destination: z
                .string()
                .optional()
                .describe("Path inside the box; defaults to the file's name in the workspace root"),
            })
          )
          .min(1)
          .max(10)
          .describe("Files to copy in (max 10 per call)"),
        ...buildBoxCommon(),
      });
    },
    handler: async (params) => {
      const { box_id, files } = params;
      const client = getBoxClient(params);

      const form = new FormData();
      const summary: string[] = [];
      for (const entry of files) {
        const localPath = path.resolve(entry.local_path);
        const info = await statLocal(localPath).catch(() => {});
        if (info === undefined) throw new Error(`No such file on this machine: ${localPath}`);
        if (info.isDirectory()) {
          throw new Error(
            `${localPath} is a directory; upload its files individually, or clone the repository into the box with box_git`
          );
        }
        if (info.size > MAX_UPLOAD_BYTES) {
          throw new Error(
            `${localPath} is ${info.size} bytes, over the ${MAX_UPLOAD_BYTES}-byte per-file limit`
          );
        }
        const destination = entry.destination ?? path.basename(localPath);
        // `paths` and `files` are positional: the server pairs them by index and
        // rejects the request when the counts differ.
        form.append("paths", destination);
        form.append("files", new Blob([await readFile(localPath)]), path.basename(destination));
        summary.push(`${localPath} -> ${destination}`);
      }

      await client.post(`v2/box/${box_id}/files/upload`, form);
      return [`Uploaded ${files.length} file(s) into the box:`, ...summary];
    },
  }),
};

/** Per-file ceiling the upload endpoint enforces. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Apply an exact-match edit, refusing anything ambiguous.
 *
 * Read-modify-write across two calls cannot be atomic, so the least it can do
 * is never guess: zero matches and several matches are both errors, matching
 * the local Edit tool's contract.
 *
 * Exported for unit tests.
 * @param content - the file as read from the box.
 * @param oldString - text the caller expects to find exactly once.
 * @param newString - replacement text.
 * @param path - only used to make the messages actionable.
 * @returns the new file text and a human-readable summary.
 */
export function applyEdit(
  content: string,
  oldString: string,
  newString: string,
  path: string
): { text: string; message: string } {
  if (oldString === newString) {
    throw new Error("old_string and new_string are identical; nothing to change");
  }
  const first = content.indexOf(oldString);
  if (first === -1) {
    throw new Error(`old_string was not found in ${path}; read the file and copy the exact text`);
  }
  if (content.includes(oldString, first + oldString.length)) {
    const count = content.split(oldString).length - 1;
    throw new Error(
      `old_string appears ${count} times in ${path}; include more surrounding context so it matches exactly once`
    );
  }
  return {
    text: content.slice(0, first) + newString + content.slice(first + oldString.length),
    message: `Edited ${path}`,
  };
}

/**
 * Query for the list endpoint.
 *
 * The parameter is `folder`, not `path`: sending `path` is silently ignored and
 * every call would list the workspace root instead of the directory asked for.
 * @param folder - directory inside the box, or undefined for the workspace root.
 * @returns the query object to send.
 */
export function buildListQuery(folder?: string): Record<string, string> {
  return folder === undefined ? {} : { folder };
}

/**
 * Unwrap a list response.
 *
 * The endpoint returns `{ files: [...] }` and uses `null` for an empty
 * directory, so treating the envelope as an array yields `undefined.length`.
 * @param res - the raw response body.
 * @returns the entries, never null.
 */
export function unwrapFiles(res?: ListFilesResponse): FileEntry[] {
  return res?.files ?? [];
}

/**
 * Query for the read endpoint.
 *
 * A ranged read is selected by the PRESENCE of `length`, so an unset length must
 * not be serialized at all — `length=0` would read zero bytes and look like an
 * empty file.
 * @param input - path plus the optional range and encoding.
 * @returns the query object to send.
 */
export function buildReadQuery(input: {
  path: string;
  offset?: number | undefined;
  length?: number | undefined;
  encoding?: "base64" | undefined;
}): Record<string, string | number> {
  const query: Record<string, string | number> = { path: input.path };
  if (input.encoding !== undefined) query.encoding = input.encoding;
  if (input.length !== undefined) {
    query.length = input.length;
    query.offset = input.offset ?? 0;
  }
  return query;
}
