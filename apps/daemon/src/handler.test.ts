import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseNote } from "@lumos/vault-utils";
import { handleMessage } from "./handler";

// The handler takes its vault as an argument, so the suite owns a temporary directory and
// the real vault is never touched.
let vault = "";

beforeAll(async () => {
  vault = await mkdtemp(path.join(tmpdir(), "lumos-daemon-"));
});

afterAll(async () => {
  await rm(vault, { recursive: true, force: true });
});

/** Filenames currently sitting in one vault folder (empty when it does not exist). */
async function filesIn(folder: string): Promise<string[]> {
  try {
    return (await readdir(path.join(vault, folder))).sort();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

describe("handleMessage - filing notes", () => {
  it("turns a /idea message into a Markdown note on disk", async () => {
    // The title is the first line of the message as typed, so the reply echoes it unchanged.
    const reply = await handleMessage("/idea build a habit tracker", vault);
    expect(reply).toBe("Filed in Ideas: build a habit tracker");

    const files = await filesIn("Ideas");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}-build-a-habit-tracker\.md$/);

    const { frontmatter, content } = parseNote(
      await readFile(path.join(vault, "Ideas", files[0]), "utf8"),
    );
    expect(frontmatter.source).toBe("whatsapp");
    expect(content).toContain("# build a habit tracker");
  });

  it("files plain text in the Inbox", async () => {
    const reply = await handleMessage("a thought with no command", vault);
    expect(reply).toBe("Filed in Inbox: a thought with no command");
    expect(await filesIn("Inbox")).toHaveLength(1);
  });

  it("takes the hashtags of a message as the note's tags", async () => {
    const reply = await handleMessage("/idea plan the Kyoto trip #travel #Japan", vault);
    expect(reply).toBe("Filed in Ideas: plan the Kyoto trip #travel #Japan");

    const file = (await filesIn("Ideas")).find((name) => name.includes("kyoto"));
    expect(file).toBeDefined();
    const { frontmatter } = parseNote(
      await readFile(path.join(vault, "Ideas", file ?? ""), "utf8"),
    );
    expect(frontmatter.tags).toEqual(["travel", "japan"]);
  });

  it("keeps the link in the frontmatter", async () => {
    const url = "https://example.com/rust-async";
    const reply = await handleMessage(`/read ${url}`, vault);
    expect(reply).toBe("Filed in Reading: example.com");

    const files = await filesIn("Reading");
    expect(files).toHaveLength(1);
    const { frontmatter } = parseNote(
      await readFile(path.join(vault, "Reading", files[0]), "utf8"),
    );
    expect(frontmatter.url).toBe(url);
  });

  it("asks for content instead of writing an empty note", async () => {
    const before = await filesIn("Interviews");
    expect(await handleMessage("/interview", vault)).toBe(
      "Add some text or a link after the command.",
    );
    expect(await filesIn("Interviews")).toEqual(before);
  });
});

describe("handleMessage - replies", () => {
  it("answers /plan with the model's plan, over an injected Ollama", async () => {
    // The handler owns no Ollama: the caller injects it, so this stays offline like every suite.
    await handleMessage("/idea ship the release", vault);
    const fetchImpl = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ response: "1. Ship the release" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const reply = await handleMessage("/plan tomorrow", vault, {
      plan: { fetchImpl, url: "http://ollama.test:11434", model: "test-model" },
    });

    expect(reply).toBe("1. Ship the release");
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body));
    expect(body.prompt).toContain("ship the release");
    expect(body.prompt).toContain("tomorrow");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://ollama.test:11434/api/generate");
  });

  it("says there is nothing to plan from without waking Ollama", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "lumos-plan-empty-"));
    const fetchImpl = vi.fn();
    try {
      const reply = await handleMessage("/plan today", empty, {
        plan: { fetchImpl, url: "http://ollama.test:11434" },
      });
      expect(reply).toBe("There are no notes to plan from yet.");
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it("answers /help with the command list", async () => {
    const reply = await handleMessage("/help", vault);
    expect(reply).toContain("/idea <text or link> -> Ideas");
    expect(reply).toContain("No command at all -> Inbox.");
  });

  it("lists one line per folder the vault has, in order", async () => {
    // The whole menu, so a command that is added or renamed has to be added here too.
    expect((await handleMessage("/help", vault)).split("\n")).toEqual([
      "Lumos - send a command and the message is filed.",
      "/inbox <text or link> -> Inbox",
      "/idea <text or link> -> Ideas",
      "/interview <text or link> -> Interviews",
      "/goal <text or link> -> Goals",
      "/read <text or link> -> Reading",
      "/newfolder <name> - then /<name> files into it",
      "/plan today | tomorrow",
      "/find <query>",
      "/help",
      "No command at all -> Inbox.",
    ]);
  });

  it("opens the menu for a bare slash", async () => {
    expect(await handleMessage("/", vault)).toBe(await handleMessage("/help", vault));
  });

  it("lists the commands for an unknown one", async () => {
    const reply = await handleMessage("/bogus something", vault);
    expect(reply).toContain("Unknown command /bogus");
    expect(reply).toContain("/goal <text or link> -> Goals");
  });
});

describe("handleMessage - folders the person makes", () => {
  it("creates a folder and says which command now files into it", async () => {
    expect(await handleMessage("/newfolder Movies", vault)).toBe(
      "Created Movies. Send /movies <text> to file into it.",
    );
    expect(await filesIn("Movies")).toEqual([]);
  });

  it("files a later message into the new folder", async () => {
    const reply = await handleMessage("/movies https://example.com/trailer", vault);
    expect(reply).toBe("Filed in Movies: example.com");
    expect(await filesIn("Movies")).toHaveLength(1);

    const file = (await filesIn("Movies"))[0];
    const { frontmatter } = parseNote(await readFile(path.join(vault, "Movies", file), "utf8"));
    expect(frontmatter.url).toBe("https://example.com/trailer");
  });

  it("announces the new command in the menu", async () => {
    expect(await handleMessage("/", vault)).toContain("/movies <text or link> -> Movies");
  });

  it("refuses a name already in use instead of pretending", async () => {
    expect(await handleMessage("/newfolder Movies", vault)).toBe(
      "A folder called Movies is already there.",
    );
  });

  it("refuses a name that would leave the vault, and says which rule it broke", async () => {
    for (const name of ["../escape", "a/b"]) {
      expect(await handleMessage(`/newfolder ${name}`, vault)).toBe(
        'A folder name cannot contain / \\ : * ? " < > |',
      );
    }
    expect(await handleMessage("/newfolder .hidden", vault)).toBe(
      "A folder name cannot start with a dot.",
    );
    expect(await handleMessage("/newfolder", vault)).toBe("Usage: /newfolder <name>");
  });
});

describe("handleMessage - /find", () => {
  it("finds a note filed earlier and names its folder", async () => {
    await handleMessage("/goal ship a zeta cli", vault);
    const reply = await handleMessage("/find zeta", vault);
    expect(reply).toContain('Found 1 note for "zeta":');
    expect(reply).toContain("- ship a zeta cli (Goals)");
  });

  it("matches case-insensitively", async () => {
    expect(await handleMessage("/find ZETA", vault)).toContain("- ship a zeta cli (Goals)");
  });

  it("says so when nothing matches", async () => {
    expect(await handleMessage("/find quantum nonsense", vault)).toBe(
      'No notes match "quantum nonsense".',
    );
  });

  it("asks for a query when none is given", async () => {
    expect(await handleMessage("/find", vault)).toBe("Usage: /find <query>");
  });

  it("caps the list at five notes and counts the rest", async () => {
    for (let i = 1; i <= 6; i += 1) {
      await handleMessage(`/idea streak goal ${i}`, vault);
    }
    const lines = (await handleMessage("/find streak", vault)).split("\n");
    expect(lines[0]).toBe('Found 6 notes for "streak":');
    expect(lines).toHaveLength(7);
    expect(lines[6]).toBe("and 1 more.");
  });
});
