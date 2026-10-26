/**
 * The entry point, exercised the way a client launches it.
 *
 * Every other suite drives the server in-process, so nothing would notice a broken `index.ts`, a
 * `console.log` that lands in the middle of the protocol, or a process that refuses to die when its
 * stdin closes. This file spawns the real thing and speaks JSON-RPC down a real pipe: the framing,
 * the handshake and the shutdown are all the client's side of the wire.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** One JSON-RPC message, as far as these tests care about the shape. */
interface Message {
  id?: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

let vault = "";
let child: ChildProcessWithoutNullStreams;
let nextId = 1;
const waiting = new Map<number, (message: Message) => void>();
/** Lines stdout carried that were not JSON, which no client could read. */
let notProtocol: string[] = [];
/** Everything stderr said, so a failure can show the server's own words. */
let diagnostics = "";

/** Launch the server exactly as documented: from its own directory, over stdio pipes. */
function launch(vaultDir: string): ChildProcessWithoutNullStreams {
  const proc = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, LUMOS_VAULT: vaultDir },
  });

  let buffer = "";
  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    // Messages are newline-delimited, so a chunk is not a message and the tail is kept.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let message: Message;
      try {
        message = JSON.parse(line) as Message;
      } catch {
        notProtocol.push(line);
        continue;
      }
      if (typeof message.id === "number") waiting.get(message.id)?.(message);
    }
  });

  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => (diagnostics += chunk));

  return proc;
}

/** Send a request and wait for the message carrying its id. */
function request(method: string, params: unknown = {}): Promise<Message> {
  const id = nextId++;
  const answered = new Promise<Message>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error(`${method} was never answered; stderr said: ${diagnostics}`));
    }, 15000);
    waiting.set(id, (message) => {
      clearTimeout(timer);
      waiting.delete(id);
      resolve(message);
    });
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return answered;
}

/** The text of a tool result, which is all these tools answer with. */
function textOf(message: Message): string {
  const content = message.result?.content as { type: string; text?: string }[] | undefined;
  return (content ?? []).map((item) => item.text ?? "").join("\n");
}

beforeEach(async () => {
  vault = await mkdtemp(path.join(tmpdir(), "lumos-mcp-stdio-"));
  nextId = 1;
  notProtocol = [];
  diagnostics = "";
  waiting.clear();
  child = launch(vault);
});

afterEach(async () => {
  // A test that failed mid-handshake leaves the process running; killing it is the cleanup, and a
  // process already gone is fine.
  if (child.exitCode === null) child.kill();
  await rm(vault, { recursive: true, force: true });
});

describe("the stdio entry point", () => {
  it("answers initialize, says what it is, and hands the model its instructions", async () => {
    const init = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0.0.0" },
    });

    expect(init.error).toBeUndefined();
    expect(init.result?.serverInfo).toMatchObject({ name: "lumos" });
    expect(typeof init.result?.protocolVersion).toBe("string");
    expect(String(init.result?.instructions)).toContain("Notes are addressed by key");
  }, 20000);

  it("lists the twelve tools over the pipe, and writes nothing but protocol to stdout", async () => {
    await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0.0.0" },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );

    const listed = await request("tools/list");
    const tools = (listed.result?.tools ?? []) as { name: string }[];
    expect(tools).toHaveLength(12);
    expect(tools.map((tool) => tool.name)).toContain("create_note");

    // The vault path is a diagnostic and belongs on stderr; one log line on stdout would be read
    // as a malformed message and end the session.
    expect(notProtocol).toEqual([]);
  }, 20000);

  it("writes a note into the vault on disk, and reads it back by key", async () => {
    await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0.0.0" },
    });

    await request("tools/call", { name: "create_folder", arguments: { name: "Inbox" } });
    const created = await request("tools/call", {
      name: "create_note",
      arguments: { folder: "Inbox", text: "A note from a spawned server" },
    });
    const key = /created (Inbox\/\S+\.md)/.exec(textOf(created))?.[1] ?? "";
    expect(key).toMatch(/^Inbox\/\d{4}-\d{2}-\d{2}-a-note-from-a-spawned-server\.md$/);

    // The file is in the vault this process was told to serve, not in the repository's.
    const written = await readdir(path.join(vault, "Inbox"));
    expect(written).toEqual([key.split("/")[1]]);

    const read = await request("tools/call", { name: "read_note", arguments: { key } });
    expect(textOf(read)).toContain("A note from a spawned server");
  }, 20000);

  it("exits cleanly when the client closes stdin, which is how Claude Code stops it", async () => {
    await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0.0.0" },
    });

    const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
    child.stdin.end();
    expect(await exited).toBe(0);
  }, 20000);
});
