import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  it("says /plan is not built yet", async () => {
    expect(await handleMessage("/plan tomorrow", vault)).toBe(
      "Lumos Maxima (tomorrow) isn't built yet.",
    );
  });

  it("answers /help with the command list", async () => {
    const reply = await handleMessage("/help", vault);
    expect(reply).toContain("/idea <text>");
    expect(reply).toContain("Anything without a command goes to Inbox.");
  });

  it("answers a malformed command instead of throwing", async () => {
    const reply = await handleMessage("/", vault);
    expect(reply).toContain("Unknown command /");
    expect(reply).toContain("Commands:");
  });

  it("lists the commands for an unknown one", async () => {
    const reply = await handleMessage("/bogus something", vault);
    expect(reply).toContain("Unknown command /bogus");
    expect(reply).toContain("/goal <text>");
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
