import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NoteFileError } from "@lumos/vault-utils";
import {
  createFolder,
  createNote,
  deleteNote,
  listFolders,
  listNotes,
  listTrash,
  moveNote,
  readNote,
  renameNote,
  restoreNote,
  searchNotes,
  updateNote,
  vaultHealth,
} from "./tools";

let vault = "";

beforeEach(async () => {
  vault = await mkdtemp(path.join(tmpdir(), "lumos-mcp-"));
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

/**
 * A note written through the same tools a client would use.
 *
 * The folders these tests use are the ones every vault already has, so a second note in the same
 * folder is the normal case rather than a folder that has to be made first - creating it again is
 * refused, which is the behaviour another test pins.
 */
async function seed(folder = "Inbox", text = "Plan the week"): Promise<{ key: string }> {
  return createNote(vault, { folder, text });
}

/** The refusal a call made, so a test can assert the sentence a person would see. */
async function refusal(work: () => Promise<unknown>): Promise<NoteFileError> {
  try {
    await work();
  } catch (err: unknown) {
    if (err instanceof NoteFileError) return err;
    throw err;
  }
  throw new Error("the call was expected to be refused and was not");
}

describe("creating a note", () => {
  it("files it as a captured message would be filed, and says it came from an MCP client", async () => {
    const { key } = await seed();

    expect(key).toMatch(/^Inbox\/\d{4}-\d{2}-\d{2}-plan-the-week\.md$/);
    const { note } = await readNote(vault, key);
    expect(note.title).toBe("Plan the week");
    expect(note.frontmatter.source).toBe("mcp");
    expect(note.content).toContain("# Plan the week");
  });

  it("keeps the hashtags in the text as the note's tags", async () => {
    const { key } = await seed("Ideas", "A lamp for the desk #hardware #wishlist");
    const { note } = await readNote(vault, key);
    expect(note.frontmatter.tags).toEqual(["hardware", "wishlist"]);
  });

  it("replaces the derived tags and sets a status when it is given both", async () => {
    await createFolder(vault, "Ideas");
    const { key, note } = await createNote(vault, {
      folder: "Ideas",
      text: "A lamp #ignored",
      tags: ["lighting"],
      status: "reading",
    });
    expect(note.frontmatter.tags).toEqual(["lighting"]);
    expect(note.frontmatter.status).toBe("reading");
    expect(note.file.endsWith(key.split("/")[1])).toBe(true);
  });

  it("refuses an empty note", async () => {
    await createFolder(vault, "Inbox");
    expect((await refusal(() => createNote(vault, { folder: "Inbox", text: "   " }))).reason).toBe(
      "invalid",
    );
  });

  it("refuses a folder that is not there, and names the folders that are", async () => {
    const err = await refusal(() => createNote(vault, { folder: "Movies", text: "hello" }));
    expect(err.reason).toBe("missing");
    expect(err.message).toContain('there is no folder called "Movies"');
    expect(err.message).toContain("Inbox");
  });

  it("never creates a folder of its own", async () => {
    await refusal(() => createNote(vault, { folder: "Movies", text: "hello" }));
    const folders = (await listFolders(vault)).map((folder) => folder.name);
    expect(folders).not.toContain("Movies");
  });
});

describe("listing", () => {
  it("counts the notes each folder holds", async () => {
    await seed("Inbox", "first");
    await seed("Inbox", "second");
    await seed("Goals", "third");

    const folders = await listFolders(vault);
    expect(folders).toContainEqual({ name: "Inbox", notes: 2 });
    expect(folders).toContainEqual({ name: "Goals", notes: 1 });
  });

  it("answers every note newest first, and only one folder's when asked", async () => {
    const first = await seed("Inbox", "first");
    const second = await seed("Inbox", "second");
    await seed("Goals", "third");

    const all = await listNotes(vault);
    expect(all).toHaveLength(3);
    expect(all.map((entry) => entry.key)).toEqual(expect.arrayContaining([first.key, second.key]));

    const inbox = await listNotes(vault, "Inbox");
    expect(inbox.map((entry) => entry.key).sort()).toEqual([first.key, second.key].sort());
  });

  it("refuses a folder that is not there rather than answering an empty list", async () => {
    const err = await refusal(() => listNotes(vault, "Movies"));
    expect(err.reason).toBe("missing");
  });

  it("finds a note by a word in its body, not just its title", async () => {
    await seed("Inbox", "Buy a desk lamp");
    await createFolder(vault, "Goals");
    await seed("Goals", "Something else entirely");

    const hits = await searchNotes(vault, "lamp");
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe("Buy a desk lamp");
  });
});

describe("reading", () => {
  it("answers the body without the frontmatter block in it", async () => {
    const { key } = await seed("Inbox", "Plan the week\n\nMonday: think");
    const { note } = await readNote(vault, key);
    expect(note.content).toBe("# Plan the week\n\nPlan the week\n\nMonday: think");
    expect(note.content).not.toContain("---");
  });

  it("refuses a key that is not there", async () => {
    const err = await refusal(() => readNote(vault, "Inbox/2026-10-20-gone.md"));
    expect(err.reason).toBe("missing");
    expect(err.message).toContain("there is no note at Inbox/2026-10-20-gone.md");
  });

  it("refuses a key that walks out of the vault", async () => {
    expect((await refusal(() => readNote(vault, "../secrets.md"))).reason).toBe("unsafe");
    expect((await refusal(() => readNote(vault, "Inbox/../../secrets.md"))).reason).toBe("unsafe");
  });

  it("refuses a key that is not shaped like one, and says what one looks like", async () => {
    const err = await refusal(() => readNote(vault, "plan"));
    expect(err.reason).toBe("unsafe");
    expect(err.message).toContain("a note key looks like");
  });
});

describe("updating", () => {
  it("replaces the body and leaves the frontmatter exactly as it was", async () => {
    const { key } = await seed("Inbox", "Plan the week");
    const before = await readNote(vault, key);

    const updated = await updateNote(vault, { key, content: "# Plan the week\n\nRewritten." });
    expect(updated.note.content).toBe("# Plan the week\n\nRewritten.");
    expect(updated.note.frontmatter.created).toBe(before.note.frontmatter.created);
    expect(updated.note.frontmatter.source).toBe("mcp");
  });

  it("changes only the tags when only tags are sent, keeping the body", async () => {
    const { key } = await seed("Inbox", "Plan the week");
    const before = await readNote(vault, key);

    const updated = await updateNote(vault, { key, tags: ["#Planning", "weekly", "weekly"] });
    expect(updated.note.frontmatter.tags).toEqual(["planning", "weekly"]);
    expect(updated.note.content).toBe(before.note.content);
  });

  it("refuses a call that changes nothing", async () => {
    const { key } = await seed();
    const err = await refusal(() => updateNote(vault, { key }));
    expect(err.reason).toBe("invalid");
    expect(err.message).toContain("nothing to change");
  });
});

describe("renaming", () => {
  it("carries the filename, the heading and the notes that linked to it", async () => {
    const { key } = await seed("Inbox", "Learn Rust");
    await createFolder(vault, "Ideas");
    const linked = await createNote(vault, {
      folder: "Ideas",
      text: "Read this next: [[Learn Rust]]",
    });

    const renamed = await renameNote(vault, { key, title: "Learn Rust deeply" });

    expect(renamed.key).toMatch(/^Inbox\/\d{4}-\d{2}-\d{2}-learn-rust-deeply\.md$/);
    expect(renamed.updated).toEqual([linked.key]);
    const backlink = await readNote(vault, linked.key);
    expect(backlink.note.content).toContain("[[Learn Rust deeply]]");
  });

  it("refuses a name another note already holds", async () => {
    const { key } = await seed("Inbox", "One");
    await createNote(vault, { folder: "Inbox", text: "Two" });

    const err = await refusal(() => renameNote(vault, { key, title: "Two" }));
    expect(err.reason).toBe("exists");
  });
});

describe("moving", () => {
  it("keeps the filename and the bytes", async () => {
    const { key } = await seed("Inbox", "Plan the week");
    const before = await readNote(vault, key);
    await createFolder(vault, "Goals");

    const moved = await moveNote(vault, { key, folder: "Goals" });
    expect(moved.key).toBe(`Goals/${key.split("/")[1]}`);

    const after = await readNote(vault, moved.key);
    expect(after.note.content).toBe(before.note.content);
  });

  it("refuses a folder that is not there", async () => {
    const { key } = await seed();
    expect((await refusal(() => moveNote(vault, { key, folder: "Movies" }))).reason).toBe(
      "missing",
    );
  });
});

describe("deleting and restoring", () => {
  it("moves the note to the trash, lists it there, and puts it back where it was", async () => {
    const { key } = await seed("Inbox", "Plan the week");
    const entry = await deleteNote(vault, key);

    expect(entry.folder).toBe("Inbox");
    expect(await listNotes(vault)).toHaveLength(0);
    const trash = await listTrash(vault);
    expect(trash.map((item) => item.id)).toEqual([entry.id]);

    const restored = await restoreNote(vault, entry.id);
    expect(restored.key).toBe(key);
    expect(await listTrash(vault)).toHaveLength(0);
    expect(await listNotes(vault)).toHaveLength(1);
  });

  it("refuses a key that is not there rather than making an empty entry", async () => {
    const err = await refusal(() => deleteNote(vault, "Inbox/2026-10-20-gone.md"));
    expect(err.reason).toBe("missing");
    expect(await listTrash(vault)).toHaveLength(0);
  });

  it("writes nothing into the trash for a key that walks out of the vault", async () => {
    expect((await refusal(() => deleteNote(vault, "../outside.md"))).reason).toBe("unsafe");
  });
});

describe("folders", () => {
  it("creates one and refuses a second of the same name", async () => {
    expect(await createFolder(vault, "Movies")).toEqual({ folder: "Movies" });
    const err = await refusal(() => createFolder(vault, "Movies"));
    expect(err.reason).toBe("exists");
  });

  it("refuses a name with a path separator in it", async () => {
    expect((await refusal(() => createFolder(vault, "a/b"))).reason).toBe("unsafe");
  });
});

describe("the note file on disk", () => {
  it("is plain Markdown with a frontmatter block, so another editor can read it", async () => {
    const { key } = await seed("Inbox", "Plan the week #weekly");
    const { note } = await readNote(vault, key);
    const raw = await readFile(note.file, "utf8");

    expect(raw.startsWith("---\n")).toBe(true);
    expect(raw).toContain("source: mcp");
    expect(raw).toContain("tags:\n  - weekly");
    expect(path.dirname(note.file)).toBe(path.join(vault, "Inbox"));
  });
});

describe("vaultHealth", () => {
  it("counts the vault and names the notes worth opening", async () => {
    await createNote(vault, { folder: "Inbox", text: "Learn Rust" });
    await createNote(vault, { folder: "Ideas", text: "Pairs with [[Learn Rust]]" });
    await createNote(vault, { folder: "Inbox", text: "A loose thought" });

    const health = await vaultHealth(vault);

    expect(health.notes).toBe(3);
    expect(health.links).toBe(1);
    expect(health.mostLinked[0]).toEqual({
      id: expect.stringMatching(/^Inbox\/.*learn-rust\.md$/),
      label: "Learn Rust",
      count: 1,
    });
    // The note nothing links to and that links nowhere is the one worth naming.
    expect(health.orphanCount).toBe(1);
    expect(health.orphans[0]?.label).toBe("A loose thought");
  });

  it("counts an empty vault as zeroes rather than refusing", async () => {
    const health = await vaultHealth(vault);

    expect(health.notes).toBe(0);
    expect(health.links).toBe(0);
    expect(health.mostLinked).toEqual([]);
    expect(health.perFolder.every((folder) => folder.count === 0)).toBe(true);
  });
});
