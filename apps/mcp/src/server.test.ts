import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "./server";

let vault = "";
let client: Client;
let close: () => Promise<void>;

/**
 * Drive the real server through the real protocol, over a linked in-memory pair.
 *
 * Nothing here spawns a process: the transport is the only part a stdio run adds, and it is the
 * SDK's. What this proves is the part this workspace writes - the tool list a client sees, the
 * arguments each tool accepts, and the text it answers with.
 */
async function connect(): Promise<void> {
  const server = createServer({ vault });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "lumos-test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  close = async () => {
    await client.close();
    await server.close();
  };
}

/** The text of a tool result, which is all these tools answer with. */
function textOf(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = result.content as { type: string; text?: string }[];
  return content.map((item) => item.text ?? "").join("\n");
}

beforeEach(async () => {
  vault = await mkdtemp(path.join(tmpdir(), "lumos-mcp-server-"));
  await connect();
});

afterEach(async () => {
  await close();
  await rm(vault, { recursive: true, force: true });
});

describe("what a client sees", () => {
  it("introduces itself as lumos", () => {
    expect(client.getServerVersion()?.name).toBe("lumos");
  });

  it("offers every vault operation, each with a description", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "create_folder",
      "create_note",
      "delete_note",
      "list_folders",
      "list_notes",
      "list_trash",
      "move_note",
      "read_note",
      "rename_note",
      "restore_note",
      "search_notes",
      "update_note",
    ]);
    for (const tool of tools) expect(tool.description?.length ?? 0).toBeGreaterThan(40);
  });

  it("marks the tools that only read, so a client can skip asking about them", async () => {
    const { tools } = await client.listTools();
    const reading = tools
      .filter((tool) => tool.annotations?.readOnlyHint === true)
      .map((tool) => tool.name)
      .sort();
    expect(reading).toEqual([
      "list_folders",
      "list_notes",
      "list_trash",
      "read_note",
      "search_notes",
    ]);
  });

  it("says it takes a key in every tool that takes one, and what one looks like", async () => {
    const { tools } = await client.listTools();
    const noteTool = tools.find((tool) => tool.name === "read_note");
    if (!noteTool) throw new Error("read_note is not in the tool list");
    const properties = noteTool.inputSchema.properties as Record<string, { description?: string }>;
    expect(properties.key.description).toContain("Inbox/2026-10-20-trip.md");
  });
});

describe("calling the tools", () => {
  it("writes a note and then reads it back by the key it answered", async () => {
    await client.callTool({ name: "create_folder", arguments: { name: "Inbox" } });
    const created = await client.callTool({
      name: "create_note",
      arguments: { folder: "Inbox", text: "Plan the week" },
    });
    expect(created.isError).toBeFalsy();

    const key = /created (Inbox\/\S+\.md)/.exec(textOf(created))?.[1] ?? "";
    expect(key).toMatch(/^Inbox\//);

    const read = await client.callTool({ name: "read_note", arguments: { key } });
    expect(read.isError).toBeFalsy();
    expect(textOf(read)).toContain("Plan the week");
  });

  it("lists what it has written", async () => {
    await client.callTool({ name: "create_folder", arguments: { name: "Ideas" } });
    await client.callTool({
      name: "create_note",
      arguments: { folder: "Ideas", text: "A desk lamp" },
    });

    const folders = textOf(await client.callTool({ name: "list_folders", arguments: {} }));
    expect(folders).toContain("Ideas · 1 notes");

    const notes = textOf(await client.callTool({ name: "list_notes", arguments: {} }));
    expect(notes).toContain("A desk lamp");
    expect(notes).toMatch(/Ideas\/\d{4}-\d{2}-\d{2}-a-desk-lamp\.md/);
  });

  it("answers a refusal as a readable tool error rather than a broken session", async () => {
    const refused = await client.callTool({ name: "read_note", arguments: { key: "nothing.md" } });
    expect(refused.isError).toBe(true);
    expect(textOf(refused)).toContain("a note key looks like");

    // The session still works: a refusal is an answer, not a crash.
    const folders = await client.callTool({ name: "list_folders", arguments: {} });
    expect(folders.isError).toBeFalsy();
  });

  it("deletes to the trash and restores from it", async () => {
    await client.callTool({ name: "create_folder", arguments: { name: "Inbox" } });
    const created = await client.callTool({
      name: "create_note",
      arguments: { folder: "Inbox", text: "Plan the week" },
    });
    const key = /created (Inbox\/\S+\.md)/.exec(textOf(created))?.[1] ?? "";

    const deleted = await client.callTool({ name: "delete_note", arguments: { key } });
    const id = /trash as (\S+)/.exec(textOf(deleted))?.[1] ?? "";
    expect(id).not.toBe("");

    expect(textOf(await client.callTool({ name: "list_trash", arguments: {} }))).toContain(id);

    const restored = await client.callTool({ name: "restore_note", arguments: { id } });
    expect(textOf(restored)).toContain(key);
  });
});
