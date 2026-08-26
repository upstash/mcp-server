import { describe, it, expect, afterEach } from "bun:test";
import { boxManageTool, buildCreateBody, clonedRepoDir } from "./manage";
import { boxFilesTool } from "./files";
import { config } from "../../config";
import {
  applyEdit,
  buildListQuery,
  buildReadQuery,
  countOccurrences,
  resolveUploadPath,
  unwrapFiles,
} from "./files";

/**
 * Pure schema/serialization checks. These must not touch the network: the live
 * box.test.ts refuses to run without credentials, and the rules covered here
 * (which fields reach the wire, exact-match editing) are exactly the ones that
 * silently produce a wrong request rather than an obvious failure.
 */

describe("create body", () => {
  it("omits agent and model entirely for a plain workspace box", () => {
    const body = buildCreateBody({ runtime: "node", clone_repo: "https://github.com/a/b" });
    expect(body).toEqual({ runtime: "node", clone_repo: "https://github.com/a/b" });
    // Presence of the key is what starts an agent box, so it must be absent,
    // not empty.
    expect("agent" in body).toBe(false);
    expect("model" in body).toBe(false);
  });

  it("never sends an empty string for agent", () => {
    const body = buildCreateBody({ agent: "", model: "" });
    expect("agent" in body).toBe(false);
    expect("model" in body).toBe(false);
  });

  it("keeps false and zero, which are meaningful", () => {
    const body = buildCreateBody({ ephemeral: false, keep_alive: false, ttl: 0 });
    expect(body).toEqual({ ephemeral: false, keep_alive: false, ttl: 0 });
  });

  it("sends labels as an array", () => {
    expect(buildCreateBody({ labels: ["work"] }).labels).toEqual(["work"]);
  });

  it("sends only the mode for a non-custom network policy", () => {
    expect(buildCreateBody({ network_policy: { mode: "deny-all" } }).network_policy).toEqual({
      mode: "deny-all",
    });
  });

  it("sends the lists only for a custom network policy", () => {
    const body = buildCreateBody({
      network_policy: { mode: "custom", allowed_domains: ["upstash.com"] },
    });
    expect(body.network_policy).toEqual({
      mode: "custom",
      allowed_domains: ["upstash.com"],
      allowed_cidrs: undefined,
      denied_cidrs: undefined,
    });
  });
});

describe("box_edit exact matching", () => {
  it("replaces a unique match", () => {
    const { text } = applyEdit("a\nb\nc\n", "b", "B", "f.txt");
    expect(text).toBe("a\nB\nc\n");
  });

  it("refuses when the string is missing", () => {
    expect(() => applyEdit("a\n", "zzz", "y", "f.txt")).toThrow(/not found/);
  });

  it("refuses when the string appears more than once, naming the count", () => {
    // Replacing the first match here would silently corrupt the file.
    expect(() => applyEdit("x\nx\n", "x", "y", "f.txt")).toThrow(/appears 2 times/);
  });

  it("refuses a no-op edit", () => {
    expect(() => applyEdit("a\n", "a", "a", "f.txt")).toThrow(/identical/);
  });

  it("preserves surrounding bytes exactly", () => {
    const { text } = applyEdit("const a = 1;\nconst b = 2;\n", "const b = 2;", "const b = 3;", "f");
    expect(text).toBe("const a = 1;\nconst b = 3;\n");
  });
});

// box_api_key is required unless the server was started with one, and zod skips
// superRefine when the base object already failed, so it is always sent.
const parseManage = (input: Record<string, unknown>) =>
  boxManageTool.box_manage.inputSchema!.safeParse({ box_api_key: "box_test", ...input });

describe("create validation rules", () => {
  const parse = parseManage;
  const messages = (result: ReturnType<typeof parse>) =>
    result.success ? [] : result.error.issues.map((i) => i.message);

  it("accepts a workspace create with neither agent nor model", () => {
    expect(parse({ action: "create", runtime: "node", clone_repo: "u" }).success).toBe(true);
  });

  it("rejects keep_alive together with ephemeral", () => {
    const result = parse({ action: "create", keep_alive: true, ephemeral: true });
    expect(result.success).toBe(false);
    expect(messages(result).join(" ")).toMatch(/mutually exclusive/);
  });

  it("rejects init_command without keep_alive, and points at box_exec", () => {
    const result = parse({ action: "create", init_command: "apt install -y ripgrep" });
    expect(result.success).toBe(false);
    expect(messages(result).join(" ")).toMatch(/keep_alive=true.*box_exec/s);
  });

  it("accepts init_command when keep_alive is set", () => {
    expect(parse({ action: "create", init_command: "x", keep_alive: true }).success).toBe(true);
  });

  it("requires model only when agent is set", () => {
    expect(parse({ action: "create", agent: "claude-code" }).success).toBe(false);
    expect(
      parse({ action: "create", agent: "claude-code", model: "claude/sonnet_4_6" }).success
    ).toBe(true);
  });

  it("does not apply create rules to other actions", () => {
    expect(
      parse({ action: "delete", box_id: "b", keep_alive: true, ephemeral: true }).success
    ).toBe(true);
  });
});

describe("files wire format", () => {
  it("lists with 'folder', because 'path' is ignored by the endpoint", () => {
    // Sending `path` silently lists the workspace root instead of the directory.
    expect(buildListQuery("src")).toEqual({ folder: "src" });
    expect(buildListQuery()).toEqual({});
  });

  it("unwraps the list envelope, including null for an empty directory", () => {
    expect(unwrapFiles({ files: null })).toEqual([]);
    expect(unwrapFiles()).toEqual([]);
    const entry = { name: "a", path: "/a", size: 1, is_dir: false, mod_time: "t" };
    expect(unwrapFiles({ files: [entry] })).toEqual([entry]);
  });

  it("omits length entirely for a whole-file read", () => {
    const query = buildReadQuery({ path: "a.txt" });
    expect(query).toEqual({ path: "a.txt" });
    expect("length" in query).toBe(false);
    expect("offset" in query).toBe(false);
  });

  it("sends length=0 only when the caller asked for zero bytes", () => {
    // Presence selects a ranged read, so 0 must survive rather than be dropped.
    expect(buildReadQuery({ path: "a.txt", length: 0 })).toEqual({
      path: "a.txt",
      length: 0,
      offset: 0,
    });
  });

  it("defaults offset to 0 when only length is given", () => {
    expect(buildReadQuery({ path: "a.txt", length: 5 })).toEqual({
      path: "a.txt",
      length: 5,
      offset: 0,
    });
  });

  it("passes encoding through", () => {
    expect(buildReadQuery({ path: "a.png", encoding: "base64" })).toEqual({
      path: "a.png",
      encoding: "base64",
    });
  });
});

const parseRead = (input: Record<string, unknown>) =>
  boxFilesTool.box_read.inputSchema!.safeParse({ box_api_key: "box_test", ...input });

describe("box_read schema", () => {
  it("rejects offset without length instead of silently dropping it", () => {
    const result = parseRead({ box_id: "b", path: "a.txt", offset: 10 });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues[0].message).toMatch(/pass 'length'/);
  });

  it("accepts a ranged read and a whole-file read", () => {
    expect(parseRead({ box_id: "b", path: "a.txt", offset: 10, length: 5 }).success).toBe(true);
    expect(parseRead({ box_id: "b", path: "a.txt" }).success).toBe(true);
  });
});

describe("clone directory", () => {
  it("derives the directory a clone lands in", () => {
    // Git tools default to the workspace root, so callers have to be told the
    // repo is one level down or they go hunting for it.
    expect(clonedRepoDir("https://github.com/octocat/Hello-World")).toBe("Hello-World");
    expect(clonedRepoDir("https://github.com/octocat/Hello-World.git")).toBe("Hello-World");
    expect(clonedRepoDir("https://github.com/octocat/Hello-World/")).toBe("Hello-World");
    expect(clonedRepoDir("git@github.com:octocat/Hello-World.git")).toBe("Hello-World");
    // Order matters: the slash comes off first, or this yields "Hello-World.git".
    expect(clonedRepoDir("https://github.com/octocat/Hello-World.git/")).toBe("Hello-World");
  });

  it("returns nothing when there is no clone", () => {
    expect(clonedRepoDir()).toBeUndefined();
    expect(clonedRepoDir("")).toBeUndefined();
  });
});

describe("overlapping matches", () => {
  it("counts overlapping occurrences", () => {
    // "aa" starts at index 0 and 1 of "aaa"; split() and a search resumed past
    // the first match both report one.
    expect(countOccurrences("aaa", "aa")).toBe(2);
    expect(countOccurrences("aaaa", "aa")).toBe(3);
    expect(countOccurrences("abc", "z")).toBe(0);
  });

  it("refuses an edit whose match overlaps itself", () => {
    // Previously this replaced index 0 silently.
    expect(() => applyEdit("aaa", "aa", "b", "f.txt")).toThrow(/appears 2 times/);
  });

  it("still allows a genuinely unique match", () => {
    expect(applyEdit("abcabd", "abc", "xyz", "f.txt").text).toBe("xyzabd");
  });
});

describe("documented limits are enforced by the schema", () => {
  it("rejects a ranged read above the server's 8 MiB ceiling", () => {
    expect(parseRead({ box_id: "b", path: "a", length: 8 * 1024 * 1024 }).success).toBe(true);
    expect(parseRead({ box_id: "b", path: "a", length: 8 * 1024 * 1024 + 1 }).success).toBe(false);
  });

  it("rejects more than five labels, or a label over 20 characters", () => {
    const base = { action: "create", runtime: "node" };
    expect(parseManage({ ...base, labels: ["a", "b", "c", "d", "e"] }).success).toBe(true);
    expect(parseManage({ ...base, labels: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
    expect(parseManage({ ...base, labels: ["x".repeat(20)] }).success).toBe(true);
    expect(parseManage({ ...base, labels: ["x".repeat(21)] }).success).toBe(false);
  });

  it("caps box_upload at ten files", () => {
    const files = Array.from({ length: 11 }, (_unused, i) => ({ local_path: `/tmp/${i}` }));
    const schema = boxFilesTool.box_upload.inputSchema!;
    expect(
      schema.safeParse({ box_api_key: "box_test", box_id: "b", files: files.slice(0, 10) }).success
    ).toBe(true);
    expect(schema.safeParse({ box_api_key: "box_test", box_id: "b", files }).success).toBe(false);
  });
});

describe("empty search string", () => {
  it("counts nothing rather than looping forever", () => {
    // indexOf("", n) returns the clamped index, never -1, so an unguarded loop
    // here would pin the process.
    expect(countOccurrences("abc", "")).toBe(0);
  });

  it("is rejected by applyEdit", () => {
    expect(() => applyEdit("abc", "", "x", "f.txt")).toThrow(/must not be empty/);
  });

  it("is rejected by the schema", () => {
    const schema = boxFilesTool.box_edit.inputSchema!;
    const base = { box_api_key: "box_test", box_id: "b", path: "a", new_string: "x" };
    expect(schema.safeParse({ ...base, old_string: "" }).success).toBe(false);
    expect(schema.safeParse({ ...base, old_string: "a" }).success).toBe(true);
  });
});

describe("upload path confinement", () => {
  const originalRoots = [...config.uploadRoots];
  afterEach(() => {
    config.uploadRoots = [...originalRoots];
  });

  it("allows any path when no roots are configured", async () => {
    config.uploadRoots = [];
    await expect(resolveUploadPath("/etc/hosts")).resolves.toContain("hosts");
  });

  it("rejects a path outside every configured root", async () => {
    config.uploadRoots = ["/tmp/allowed-root"];
    await expect(resolveUploadPath("/etc/passwd")).rejects.toThrow(/outside the directories/);
  });

  it("rejects a sibling directory that merely shares a prefix", async () => {
    // "/tmp/allowed-root-evil" must not pass a naive startsWith check.
    config.uploadRoots = ["/tmp/allowed-root"];
    await expect(resolveUploadPath("/tmp/allowed-root-evil/secret")).rejects.toThrow(
      /outside the directories/
    );
  });

  it("allows a path inside a configured root", async () => {
    config.uploadRoots = ["/tmp"];
    await expect(resolveUploadPath("/tmp/some-file.txt")).resolves.toBe("/tmp/some-file.txt");
  });
});
