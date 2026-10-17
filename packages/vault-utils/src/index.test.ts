import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildVaultGraph,
  defaultFrontmatter,
  getNotesByFolder,
  listNotes,
  makeTitle,
  parseNote,
  readNote,
  saveNote,
  searchNotes,
  serializeNote,
  slugify,
} from "./index";

let vault = "";

beforeEach(async () => {
  vault = await mkdtemp(path.join(tmpdir(), "lumos-vault-utils-"));
});

afterEach(async () => {
  await rm(vault, { recursive: true, force: true });
});

/** Drop a raw Markdown file into the temp vault and return its absolute path. */
async function put(folder: string, name: string, raw: string): Promise<string> {
  const dir = path.join(vault, folder);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, raw, "utf8");
  return file;
}

const ISO_DATE = new Date().toISOString().slice(0, 10);

describe("slugify", () => {
  it("lower-cases and dashes a title", () => {
    expect(slugify("Build a Habit Tracker")).toBe("build-a-habit-tracker");
  });

  it("collapses punctuation runs and trims the edges", () => {
    expect(slugify("  Rust: async/await!  ")).toBe("rust-async-await");
  });

  it("falls back to 'note' when nothing survives", () => {
    expect(slugify("")).toBe("note");
    expect(slugify("!!!")).toBe("note");
  });

  it("caps the slug at 50 characters", () => {
    expect(slugify("a".repeat(80))).toHaveLength(50);
  });

  it("neutralises path separators", () => {
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  });
});

describe("makeTitle", () => {
  it("uses the first line of multi-line text", () => {
    expect(makeTitle({ text: "Ship the CLI\nmore detail here" })).toBe("Ship the CLI");
  });

  it("truncates a long title to 60 characters", () => {
    const title = makeTitle({ text: "x".repeat(100) });
    expect(title).toHaveLength(60);
    expect(title.endsWith("...")).toBe(true);
  });

  it("falls back to the link hostname when there is no text", () => {
    expect(makeTitle({ text: "", url: "https://example.com/post" })).toBe("example.com");
  });

  it("returns Untitled when there is neither usable text nor a link", () => {
    expect(makeTitle({ text: "   ", url: "not a url" })).toBe("Untitled");
  });
});

describe("parseNote", () => {
  it("round-trips a serialized note", () => {
    const raw = serializeNote(defaultFrontmatter("desktop"), "# Title\n\nBody text");
    const { frontmatter, content } = parseNote(raw);
    expect(frontmatter.source).toBe("desktop");
    expect(frontmatter.tags).toEqual([]);
    expect(frontmatter.status).toBe("new");
    expect(content).toBe("# Title\n\nBody text");
  });

  it("keeps tags and forward-compatible extra keys", () => {
    const raw = serializeNote(
      { ...defaultFrontmatter("desktop"), tags: ["rust", "cli"], priority: 3 },
      "body",
    );
    const { frontmatter } = parseNote(raw);
    expect(frontmatter.tags).toEqual(["rust", "cli"]);
    expect(frontmatter.priority).toBe(3);
  });

  it("defaults the fields a hand-written note omits", () => {
    const { frontmatter, content } = parseNote("---\nsource: desktop\n---\n\nbody");
    expect(frontmatter.source).toBe("desktop");
    expect(frontmatter.status).toBe("new");
    expect(frontmatter.tags).toEqual([]);
    expect(typeof frontmatter.created).toBe("string");
    expect(content).toBe("body");
  });

  it("normalises a single tag written as a string", () => {
    expect(parseNote("---\ntags: rust\n---\n\nbody").frontmatter.tags).toEqual(["rust"]);
  });

  it("treats a file with no frontmatter block as body only", () => {
    const { frontmatter, content } = parseNote("# Just body\n\nsome text");
    expect(content).toBe("# Just body\n\nsome text");
    expect(frontmatter.source).toBe("whatsapp");
  });

  it("treats an unterminated frontmatter block as body text", () => {
    const { content } = parseNote("---\nsource: desktop\n\nbody");
    expect(content).toBe("---\nsource: desktop\n\nbody");
  });

  it("strips a byte-order mark before reading the frontmatter", () => {
    const { frontmatter, content } = parseNote("\uFEFF---\nsource: desktop\n---\n\nbody");
    expect(frontmatter.source).toBe("desktop");
    expect(content).toBe("body");
  });

  it("reads a file written with CRLF line endings", () => {
    const { frontmatter, content } = parseNote("---\r\nsource: desktop\r\n---\r\n\r\nbody");
    expect(frontmatter.source).toBe("desktop");
    expect(content).toBe("body");
  });
});

describe("readNote", () => {
  it("takes the title from the first heading", async () => {
    const file = await put("Ideas", "2026-01-02-habit.md", "# My Heading\n\nrest of the note");
    const note = await readNote(file, "Ideas");
    expect(note.title).toBe("My Heading");
    expect(note.folder).toBe("Ideas");
    expect(note.content).toBe("# My Heading\n\nrest of the note");
  });

  it("falls back to the filename when there is no heading", async () => {
    const file = await put("Ideas", "2026-01-02-plain.md", "no heading in here");
    expect((await readNote(file, "Ideas")).title).toBe("2026-01-02-plain");
  });
});

describe("saveNote", () => {
  it("creates the folder, writes the file and titles it from the text", async () => {
    const { title, file } = await saveNote(vault, {
      folder: "Ideas",
      text: "Build a habit tracker",
    });
    expect(title).toBe("Build a habit tracker");
    expect(file).toBe(path.join(vault, "Ideas", `${ISO_DATE}-build-a-habit-tracker.md`));

    const { frontmatter, content } = parseNote(await readFile(file, "utf8"));
    expect(frontmatter.source).toBe("whatsapp");
    expect(content).toBe("# Build a habit tracker\n\nBuild a habit tracker");
  });

  it("records a link in the frontmatter", async () => {
    const url = "https://example.com/system-design";
    const { file } = await saveNote(vault, {
      folder: "Reading",
      text: "",
      url,
    });
    const { frontmatter } = parseNote(await readFile(file, "utf8"));
    expect(frontmatter.url).toBe(url);
  });

  it("turns hashtags in the message into frontmatter tags", async () => {
    const { file } = await saveNote(vault, {
      folder: "Ideas",
      text: "A habit tracker #productivity #SideProject #productivity",
    });
    const { frontmatter } = parseNote(await readFile(file, "utf8"));
    expect(frontmatter.tags).toEqual(["productivity", "sideproject"]);
  });

  it("does not read a heading or a line of code as a tag", async () => {
    const { file } = await saveNote(vault, {
      folder: "Ideas",
      text: "# Not a tag\n\n```\n#also-not\n```\n\nbut #this-is",
    });
    const { frontmatter } = parseNote(await readFile(file, "utf8"));
    expect(frontmatter.tags).toEqual(["this-is"]);
  });

  it("writes no tags when the message has none", async () => {
    const { file } = await saveNote(vault, { folder: "Goals", text: "Learn Rust" });
    const { frontmatter } = parseNote(await readFile(file, "utf8"));
    expect(frontmatter.tags).toEqual([]);
  });

  it("makes those tags visible to the listing and to search", async () => {
    await saveNote(vault, { folder: "Ideas", text: "A habit tracker #productivity" });
    const [entry] = await getNotesByFolder(vault, "Ideas");
    expect(entry.tags).toEqual(["productivity"]);

    // The title keeps the hashtag - a title is the message's first line, verbatim - so the tag is
    // what makes the note findable rather than something already visible in its name.
    const hits = await searchNotes(vault, "productivity");
    expect(hits.map((hit) => hit.title)).toEqual(["A habit tracker #productivity"]);
  });

  it("never overwrites an existing note", async () => {
    const input = { folder: "Goals" as const, text: "Learn Rust" };
    const first = await saveNote(vault, input);
    const second = await saveNote(vault, input);
    expect(second.file).not.toBe(first.file);
    // Both notes are on disk; the second one took a suffixed filename instead of clobbering.
    const written = (await getNotesByFolder(vault, "Goals")).map((n) => n.name).sort();
    expect(written).toEqual([path.basename(first.file), path.basename(second.file)].sort());
  });

  it("cannot be talked into writing outside its folder", async () => {
    const { file } = await saveNote(vault, { folder: "Ideas", text: "../../etc/passwd" });
    expect(path.dirname(file)).toBe(path.join(vault, "Ideas"));
    expect(path.basename(file)).toBe(`${ISO_DATE}-etc-passwd.md`);
  });
});

describe("listing notes", () => {
  beforeEach(async () => {
    await put(
      "Ideas",
      "2026-01-01-older.md",
      serializeNote(
        { ...defaultFrontmatter("whatsapp"), created: "2026-01-01T00:00:00.000Z" },
        "# Older",
      ),
    );
    await put(
      "Ideas",
      "2026-03-01-newer.md",
      serializeNote(
        { ...defaultFrontmatter("whatsapp"), created: "2026-03-01T00:00:00.000Z" },
        "# Newer",
      ),
    );
    await put(
      "Goals",
      "2026-02-01-goal.md",
      '---\nsource: whatsapp\ncreated: "2026-02-01T00:00:00.000Z"\ntags: []\nstatus: new\n---\n\n# Goal',
    );
    await put("Ideas", "notes.txt", "not markdown");
  });

  it("returns the entries of one folder, newest first", async () => {
    const entries = await getNotesByFolder(vault, "Ideas");
    expect(entries.map((e) => e.name)).toEqual(["2026-03-01-newer.md", "2026-01-01-older.md"]);
    expect(entries[0].title).toBe("Newer");
    expect(entries[0].folder).toBe("Ideas");
  });

  it("ignores files that are not Markdown", async () => {
    expect((await getNotesByFolder(vault, "Ideas")).map((e) => e.name)).not.toContain("notes.txt");
  });

  it("returns an empty list for a folder that does not exist", async () => {
    expect(await getNotesByFolder(vault, "Interviews")).toEqual([]);
  });

  it("lists every folder in one pass, newest first", async () => {
    const entries = await listNotes(vault);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.title)).toEqual(["Newer", "Goal", "Older"]);
  });

  it("returns an empty list when the vault directory is missing", async () => {
    expect(await listNotes(path.join(vault, "does-not-exist"))).toEqual([]);
  });

  it("truncates the preview to 200 characters", async () => {
    await put("Inbox", "2026-04-01-long.md", `# Long\n\n${"x".repeat(300)}`);
    const [entry] = await getNotesByFolder(vault, "Inbox");
    expect(entry.excerpt).toHaveLength(203);
    expect(entry.excerpt.endsWith("...")).toBe(true);
  });
});

describe("searchNotes", () => {
  beforeEach(async () => {
    await put(
      "Ideas",
      "2026-01-01-habit.md",
      '---\nsource: whatsapp\ncreated: "2026-01-01T00:00:00.000Z"\ntags: [rust]\nstatus: new\n---\n\n# Build a habit tracker\n\nA small app for daily streaks.',
    );
    await put(
      "Reading",
      "2026-01-02-deep.md",
      `---\nsource: whatsapp\ncreated: "2026-01-02T00:00:00.000Z"\ntags: []\nstatus: new\n---\n\n# Notes\n\n${"filler ".repeat(80)}pinning model`,
    );
  });

  it("returns nothing for an empty query", async () => {
    expect(await searchNotes(vault, "   ")).toEqual([]);
  });

  it("matches a title case-insensitively", async () => {
    expect((await searchNotes(vault, "HABIT")).map((e) => e.name)).toEqual(["2026-01-01-habit.md"]);
  });

  it("matches a tag", async () => {
    expect((await searchNotes(vault, "rust")).map((e) => e.name)).toEqual(["2026-01-01-habit.md"]);
  });

  it("matches text deep in the body, past the preview", async () => {
    const entries = await searchNotes(vault, "pinning");
    expect(entries.map((e) => e.name)).toEqual(["2026-01-02-deep.md"]);
    expect(entries[0].excerpt).not.toContain("pinning");
  });

  it("returns nothing when nothing matches", async () => {
    expect(await searchNotes(vault, "quantum")).toEqual([]);
  });
});

describe("buildVaultGraph", () => {
  beforeEach(async () => {
    await put(
      "Ideas",
      "2026-01-01-habit.md",
      '---\nsource: whatsapp\ncreated: "2026-01-01T00:00:00.000Z"\ntags: [ideas]\nstatus: new\n---\n\n# Build a habit tracker\n\nPairs with [[Learn Rust]] and [[missing-note]].',
    );
    await put(
      "Goals",
      "2026-01-02-rust.md",
      '---\nsource: whatsapp\ncreated: "2026-01-02T00:00:00.000Z"\ntags: []\naliases: [Rust plan]\nstatus: new\n---\n\n# Learn Rust\n\nShip a CLI in #rust',
    );
    await put(
      "Inbox",
      "2026-01-03-alias-user.md",
      '---\nsource: desktop\ncreated: "2026-01-03T00:00:00.000Z"\ntags: []\nstatus: new\n---\n\n# Alias user\n\nSee [[Rust plan]].',
    );
  });

  it("reads links, tags and aliases out of real files", async () => {
    const graph = await buildVaultGraph(vault);

    expect(graph.nodes.map((n) => n.id).sort()).toEqual([
      "#ideas",
      "#rust",
      "Goals/2026-01-02-rust.md",
      "Ideas/2026-01-01-habit.md",
      "Inbox/2026-01-03-alias-user.md",
    ]);
    expect(graph.edges).toContainEqual({
      source: "Ideas/2026-01-01-habit.md",
      target: "Goals/2026-01-02-rust.md",
      kind: "link",
    });
    expect(graph.edges).toContainEqual({
      source: "Inbox/2026-01-03-alias-user.md",
      target: "Goals/2026-01-02-rust.md",
      kind: "link",
    });
    expect(graph.edges).toContainEqual({
      source: "Goals/2026-01-02-rust.md",
      target: "#rust",
      kind: "tag",
    });
    expect(graph.unresolved).toEqual([
      { source: "Ideas/2026-01-01-habit.md", target: "missing-note" },
    ]);
  });

  it("takes the node label from the note's first heading", async () => {
    await put(
      "Reading",
      "2026-01-04-real-title.md",
      '---\nsource: whatsapp\ncreated: "2026-01-04T00:00:00.000Z"\ntags: []\nstatus: new\n---\n\n# Real title\n\nbody',
    );
    const graph = await buildVaultGraph(vault);
    const node = graph.nodes.find((n) => n.id === "Reading/2026-01-04-real-title.md");
    expect(node).toMatchObject({ label: "Real title", folder: "Reading" });
  });

  it("returns an empty graph for a vault that does not exist", async () => {
    expect(await buildVaultGraph(path.join(vault, "missing"))).toEqual({
      nodes: [],
      edges: [],
      unresolved: [],
    });
  });
});
