import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
      "/renamefolder <from>|<to> - a folder's notes and links follow",
      "/delfolder <name> - the folder goes, its notes move to Inbox",
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

describe("handleMessage - renaming and removing a folder", () => {
  // A throwaway vault per test. These operations move whole directories around, so sharing the
  // suite's vault would make every test depend on what the last one left behind - and a note's
  // filename comes from its title, so the same sentence filed twice collides by name.
  let box = "";

  beforeEach(async () => {
    box = await mkdtemp(path.join(tmpdir(), "lumos-folders-"));
  });

  afterEach(async () => {
    await rm(box, { recursive: true, force: true });
  });

  /** Filenames in one folder of this test's own vault. */
  async function files(folder: string): Promise<string[]> {
    try {
      return (await readdir(path.join(box, folder))).sort();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  it("renames a folder and counts the notes that came with it", async () => {
    await handleMessage("/newfolder Films", box);
    await handleMessage("/films a note in the new folder", box);

    expect(await handleMessage("/renamefolder Films|Cinema", box)).toBe(
      "Renamed Films to Cinema. 1 note moved.",
    );
    expect(await files("Cinema")).toHaveLength(1);
    expect(await files("Films")).toEqual([]);
  });

  it("renames a folder whose name has spaces, using the separator", async () => {
    await handleMessage("/newfolder Movie Night", box);

    expect(await handleMessage("/renamefolder Movie Night|Film Night", box)).toBe(
      "Renamed Movie Night to Film Night. 0 notes moved.",
    );
    expect(await files("Film Night")).toEqual([]);
    expect(await files("Movie Night")).toEqual([]);
  });

  it("rewrites a link that named the folder, and says how many followed", async () => {
    await handleMessage("/newfolder Films", box);
    await handleMessage("/films https://example.com/one", box);
    const [film] = await files("Films");
    // The linking note lives in a folder of its own, so this test reads back exactly one file.
    await handleMessage("/newfolder Links", box);
    await handleMessage(`/links see [[Films/${film}]] for the list`, box);

    const reply = await handleMessage("/renamefolder Films|Cinema", box);

    expect(reply).toBe("Renamed Films to Cinema. 1 note moved. 1 link(s) followed.");
    const [note] = await files("Links");
    const raw = await readFile(path.join(box, "Links", note), "utf8");
    expect(raw).toContain(`[[Cinema/${film}]]`);
    expect(raw).not.toContain("[[Films/");
  });

  it("asks for both names when the separator is missing", async () => {
    await handleMessage("/newfolder Films", box);

    expect(await handleMessage("/renamefolder Films", box)).toBe(
      "Usage: /renamefolder <from>|<to>",
    );
    expect(await files("Films")).toEqual([]);
  });

  it("refuses a folder that is not there, and one whose name is taken", async () => {
    await handleMessage("/newfolder Films", box);
    await handleMessage("/films a note", box);
    await handleMessage("/newfolder Taken", box);

    expect(await handleMessage("/renamefolder Gone|Cinema", box)).toBe(
      "There is no folder called Gone.",
    );
    expect(await handleMessage("/renamefolder Films|Taken", box)).toBe(
      "A folder called Taken is already there.",
    );
    // The refused rename left the folder and its note exactly where they were.
    expect(await files("Films")).toHaveLength(1);
  });

  it("removes a folder and moves its notes to Inbox", async () => {
    await handleMessage("/newfolder Films", box);
    await handleMessage("/films a note in the new folder", box);

    expect(await handleMessage("/delfolder Films", box)).toBe(
      "Removed Films. 1 note moved to Inbox.",
    );
    expect(await files("Films")).toEqual([]);
    expect(await files("Inbox")).toHaveLength(1);
  });

  it("removes a folder that has no notes in it", async () => {
    await handleMessage("/newfolder Empty", box);

    expect(await handleMessage("/delfolder Empty", box)).toBe(
      "Removed Empty. 0 notes moved to Inbox.",
    );
    expect(await files("Empty")).toEqual([]);
  });

  it("asks for a name when none is given, and refuses a folder that is not there", async () => {
    expect(await handleMessage("/delfolder", box)).toBe("Usage: /delfolder <name>");
    expect(await handleMessage("/delfolder Gone", box)).toBe("There is no folder called Gone.");
  });

  it("stops listing a removed folder as a command", async () => {
    await handleMessage("/newfolder Films", box);

    await handleMessage("/delfolder Films", box);

    expect(await handleMessage("/films anything", box)).toContain("Unknown command /films");
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
