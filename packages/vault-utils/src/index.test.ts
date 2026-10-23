import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildVaultGraph,
  defaultFrontmatter,
  deleteNote,
  getNotesByFolder,
  listNotes,
  makeTitle,
  moveNote,
  parseNote,
  readNote,
  renameNote,
  replaceNoteBody,
  restoreNote,
  saveNote,
  searchNotes,
  serializeNote,
  slugify,
  updateNote,
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

  it("reports nothing for a note it can read", () => {
    expect(parseNote(serializeNote(defaultFrontmatter("desktop"), "body")).problems).toEqual([]);
    expect(parseNote("# Body only").problems).toEqual([]);
  });

  it("keeps a note whose frontmatter is not valid YAML, and says so", () => {
    const { frontmatter, content, problems } = parseNote("---\nsource: [unclosed\n---\n\nbody");
    expect(problems).toEqual(["frontmatter is not valid YAML"]);
    expect(frontmatter.source).toBe("whatsapp");
    expect(content).toBe("body");
  });

  it("keeps a note whose frontmatter is a list rather than a mapping", () => {
    const { content, problems } = parseNote("---\n- one\n- two\n---\n\nbody");
    expect(problems).toEqual(["frontmatter is not a mapping"]);
    expect(content).toBe("body");
  });

  it("keeps a bad date as written and reports it, rather than inventing one", () => {
    const { frontmatter, problems } = parseNote("---\ncreated: soon\n---\n\nbody");
    expect(problems).toEqual(["created is not a date"]);
    expect(frontmatter.created).toBe("soon");
  });

  it("turns a YAML timestamp into the string the rest of the app expects", () => {
    const { frontmatter, problems } = parseNote(
      "---\ncreated: !!timestamp 2026-10-13T09:12:00Z\n---\n\nbody",
    );
    expect(problems).toEqual([]);
    expect(frontmatter.created).toBe("2026-10-13T09:12:00.000Z");
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

  it("carries the frontmatter problems onto the note", async () => {
    const file = await put("Ideas", "2026-01-02-broken.md", "---\ncreated: soon\n---\n\n# Broken");
    expect((await readNote(file, "Ideas")).problems).toEqual(["created is not a date"]);
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

  it("records where the note came from, defaulting to WhatsApp", async () => {
    const fromApp = await saveNote(
      vault,
      { folder: "Inbox", text: "Written in the app" },
      { source: "desktop" },
    );
    const { frontmatter } = parseNote(await readFile(fromApp.file, "utf8"));
    expect(frontmatter.source).toBe("desktop");

    // A note with no stated origin is still a WhatsApp capture - the capture path is unchanged.
    const captured = await saveNote(vault, { folder: "Inbox", text: "Sent over WhatsApp" });
    expect(parseNote(await readFile(captured.file, "utf8")).frontmatter.source).toBe("whatsapp");
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

describe("replaceNoteBody", () => {
  const BLOCK = "---\nsource: desktop\ncreated: 2026-01-02T00:00:00.000Z\ntags:\n  - rust\n---";

  it("keeps the frontmatter block character for character", () => {
    const raw = `${BLOCK}\n\n# Old title\n\nold body\n`;
    expect(replaceNoteBody(raw, "# New title\n\nnew body")).toBe(
      `${BLOCK}\n\n# New title\n\nnew body\n`,
    );
  });

  it("does not repair, reorder or drop a block it does not understand", () => {
    // An invalid block, a key another tool owns and a comment: all three survive the save.
    const block = "---\nsource: [x\nfoo: 1  # keep me\ncreated: soon\n---";
    const next = replaceNoteBody(`${block}\n\n# Broken\n\nrest\n`, "# Broken\n\nrewritten");
    expect(next).toBe(`${block}\n\n# Broken\n\nrewritten\n`);
  });

  it("writes just the body when the file has no frontmatter", () => {
    expect(replaceNoteBody("# Loose\n\nno block here\n", "# Loose\n\nrewritten")).toBe(
      "# Loose\n\nrewritten\n",
    );
  });

  it("keeps the block and leaves an empty body when the body is cleared", () => {
    expect(replaceNoteBody(`${BLOCK}\n\n# Old\n\nbody\n`, "")).toBe(`${BLOCK}\n`);
    expect(replaceNoteBody("no block\n", "   \n")).toBe("");
  });

  it("trims the submitted body without collapsing the blank lines inside it", () => {
    expect(replaceNoteBody(`${BLOCK}\n\n# A\n`, "\n\n# A\n\npara one\n\npara two\n\n")).toBe(
      `${BLOCK}\n\n# A\n\npara one\n\npara two\n`,
    );
  });

  it("does not mistake a horizontal rule in the body for the end of a block", () => {
    const raw = "no frontmatter\n\n---\n\nstill the body\n";
    expect(replaceNoteBody(raw, "# Kept\n\n---\n\nrule stays")).toBe(
      "# Kept\n\n---\n\nrule stays\n",
    );
  });
});

describe("updateNote", () => {
  const RAW =
    "---\nsource: desktop\ncreated: 2026-01-02T00:00:00.000Z\ntags:\n  - rust\n---\n\n# Learn Rust\n\nship a CLI\n";

  it("saves the body and returns the note as it now reads", async () => {
    await put("Goals", "2026-01-02-learn-rust.md", RAW);
    const note = await updateNote(vault, {
      folder: "Goals",
      name: "2026-01-02-learn-rust.md",
      content: "# Ship in October\n\nthe CLI first",
    });

    expect(note.title).toBe("Ship in October");
    expect(note.content).toBe("# Ship in October\n\nthe CLI first");
    expect(note.frontmatter.tags).toEqual(["rust"]);
    expect(note.frontmatter.created).toBe("2026-01-02T00:00:00.000Z");

    const raw = await readFile(path.join(vault, "Goals", "2026-01-02-learn-rust.md"), "utf8");
    expect(raw).toContain("created: 2026-01-02T00:00:00.000Z");
    expect(raw).toContain("the CLI first");
    expect(raw).not.toContain("ship a CLI");
  });

  it("still reports a broken block after the save, so it can be fixed", async () => {
    await put("Ideas", "2026-01-02-broken.md", "---\ncreated: soon\n---\n\n# Broken\n\nold\n");
    const note = await updateNote(vault, {
      folder: "Ideas",
      name: "2026-01-02-broken.md",
      content: "# Broken\n\nnew",
    });

    expect(note.problems).toEqual(["created is not a date"]);
    const raw = await readFile(path.join(vault, "Ideas", "2026-01-02-broken.md"), "utf8");
    // The invalid value is left as written rather than replaced with a guess.
    expect(raw).toContain("created: soon");
  });

  it("leaves no temporary file behind", async () => {
    await put("Ideas", "2026-01-02-a.md", RAW);
    await updateNote(vault, { folder: "Ideas", name: "2026-01-02-a.md", content: "# A\n\nb" });
    expect(await readdir(path.join(vault, "Ideas"))).toEqual(["2026-01-02-a.md"]);
  });

  it("touches only the note it was given", async () => {
    await put("Ideas", "2026-01-02-a.md", RAW);
    await put("Ideas", "2026-01-02-b.md", RAW);
    await updateNote(vault, {
      folder: "Ideas",
      name: "2026-01-02-a.md",
      content: "# A\n\nonly me",
    });

    const neighbour = await readFile(path.join(vault, "Ideas", "2026-01-02-b.md"), "utf8");
    expect(neighbour).toBe(RAW);
  });

  it("refuses a name that escapes the folder, and writes nothing", async () => {
    const outside = await put("", "secret.md", "# Secret\n\ntop secret\n");
    await expect(
      updateNote(vault, { folder: "Ideas", name: "../secret.md", content: "# Pwned\n\nha" }),
    ).rejects.toThrow("name escapes the folder");
    expect(await readFile(outside, "utf8")).toContain("top secret");
  });

  it("refuses a folder that escapes the vault, and refuses a name that is not Markdown", async () => {
    await expect(
      updateNote(vault, { folder: "..", name: "secret.md", content: "x" }),
    ).rejects.toThrow("folder escapes the vault");
    await expect(
      updateNote(vault, { folder: "Ideas", name: "notes.txt", content: "x" }),
    ).rejects.toThrow("name escapes the folder");
  });

  it("rejects a note that is not there instead of creating one", async () => {
    await expect(
      updateNote(vault, { folder: "Ideas", name: "missing.md", content: "x" }),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readdir(path.join(vault, "Ideas")).catch(() => [])).toEqual([]);
  });
});

const RAW =
  "---\nsource: desktop\ncreated: 2026-01-02T00:00:00.000Z\ntags:\n  - rust\n---\n\n# Learn Rust\n\nship a CLI\n";

describe("moveNote", () => {
  const NAME = "2026-01-02-learn-rust.md";

  it("moves the note into the other folder, bytes and all", async () => {
    await put("Ideas", NAME, RAW);
    const note = await moveNote(vault, {
      from: { folder: "Ideas", name: NAME },
      to: { folder: "Goals", name: NAME },
    });

    expect(note.folder).toBe("Goals");
    expect(note.title).toBe("Learn Rust");
    expect(await readFile(path.join(vault, "Goals", NAME), "utf8")).toBe(RAW);
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([]);
  });

  it("creates a folder the vault does not have yet", async () => {
    await put("Ideas", NAME, RAW);
    await moveNote(vault, {
      from: { folder: "Ideas", name: NAME },
      to: { folder: "Reading", name: NAME },
    });

    expect(await readdir(path.join(vault, "Reading"))).toEqual([NAME]);
  });

  it("refuses to replace a note that is already in the folder", async () => {
    await put("Ideas", NAME, RAW);
    const other = "---\ncreated: 2026-01-02T00:00:00.000Z\n---\n\n# Other\n\nnot mine\n";
    await put("Goals", NAME, other);

    await expect(
      moveNote(vault, {
        from: { folder: "Ideas", name: NAME },
        to: { folder: "Goals", name: NAME },
      }),
    ).rejects.toMatchObject({ reason: "exists" });

    // Neither note is lost to the collision.
    expect(await readFile(path.join(vault, "Ideas", NAME), "utf8")).toBe(RAW);
    expect(await readFile(path.join(vault, "Goals", NAME), "utf8")).toBe(other);
  });

  it("answers the note when it is already in that folder", async () => {
    await put("Ideas", NAME, RAW);
    const note = await moveNote(vault, {
      from: { folder: "Ideas", name: NAME },
      to: { folder: "Ideas", name: NAME },
    });

    expect(note.title).toBe("Learn Rust");
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([NAME]);
  });

  it("refuses a folder or a name that escapes the vault, and moves nothing", async () => {
    await put("Ideas", NAME, RAW);
    await expect(
      moveNote(vault, {
        from: { folder: "Ideas", name: NAME },
        to: { folder: "..", name: NAME },
      }),
    ).rejects.toMatchObject({ reason: "unsafe" });
    await expect(
      moveNote(vault, {
        from: { folder: "Ideas", name: `../${NAME}` },
        to: { folder: "Goals", name: NAME },
      }),
    ).rejects.toMatchObject({ reason: "unsafe" });

    expect(await readdir(path.join(vault, "Ideas"))).toEqual([NAME]);
    expect(await readdir(path.join(vault, "Goals")).catch(() => [])).toEqual([]);
  });

  it("reports a note that is not there, and creates no folder for it", async () => {
    await expect(
      moveNote(vault, {
        from: { folder: "Ideas", name: "missing.md" },
        to: { folder: "Goals", name: "missing.md" },
      }),
    ).rejects.toMatchObject({ reason: "missing" });

    expect(await readdir(path.join(vault, "Goals")).catch(() => [])).toEqual([]);
  });
});

describe("renameNote", () => {
  const NAME = "2026-01-02-learn-rust.md";

  it("names the file after the new title and keeps the date prefix", async () => {
    await put("Goals", NAME, RAW);
    const { note, updated } = await renameNote(vault, {
      folder: "Goals",
      name: NAME,
      title: "Learn Rust properly",
    });

    // Nothing else in this vault links here, so nothing else was edited.
    expect(updated).toEqual([]);
    expect(note.title).toBe("Learn Rust properly");
    expect(note.file).toBe(path.join(vault, "Goals", "2026-01-02-learn-rust-properly.md"));
    expect(await readdir(path.join(vault, "Goals"))).toEqual(["2026-01-02-learn-rust-properly.md"]);
  });

  it("rewrites the first heading and leaves the frontmatter as it was written", async () => {
    await put("Goals", NAME, RAW);
    await renameNote(vault, { folder: "Goals", name: NAME, title: "Ship a CLI" });

    const raw = await readFile(path.join(vault, "Goals", "2026-01-02-ship-a-cli.md"), "utf8");
    expect(raw).toBe(RAW.replace("# Learn Rust", "# Ship a CLI"));
  });

  it("does not mistake a '#' line in the frontmatter for the title", async () => {
    const raw = "---\n# a note to self\ncreated: 2026-01-02T00:00:00.000Z\n---\n\nbody only\n";
    await put("Ideas", "2026-01-02-commented.md", raw);

    await renameNote(vault, {
      folder: "Ideas",
      name: "2026-01-02-commented.md",
      title: "Body only",
    });

    const written = await readFile(path.join(vault, "Ideas", "2026-01-02-body-only.md"), "utf8");
    expect(written).toContain("# a note to self");
    expect(written).toContain("body only");
  });

  it("keeps the filename when the title slugs to the name it already has", async () => {
    await put("Goals", NAME, RAW);
    const { note } = await renameNote(vault, {
      folder: "Goals",
      name: NAME,
      title: "learn rust",
    });

    expect(path.basename(note.file)).toBe(NAME);
    // The heading is still rewritten, because it is the title the app shows.
    expect(note.title).toBe("learn rust");
    expect(await readdir(path.join(vault, "Goals"))).toEqual([NAME]);
  });

  it("gives a name that had no date one that has none either", async () => {
    await put("Ideas", "scratch.md", RAW);
    const { note } = await renameNote(vault, {
      folder: "Ideas",
      name: "scratch.md",
      title: "Scratch pad",
    });

    expect(path.basename(note.file)).toBe("scratch-pad.md");
  });

  it("rewrites the links other notes have to the old title, and names them", async () => {
    await put("Goals", NAME, RAW);
    await put(
      "Ideas",
      "2026-01-01-reference.md",
      "---\nsource: whatsapp\ncreated: 2026-01-01T00:00:00.000Z\ntags: []\n---\n\n# Reference\n\nsee [[Learn Rust]] and [[Learn Rust#Ship a CLI|the plan]] for detail\n",
    );

    const { updated } = await renameNote(vault, {
      folder: "Goals",
      name: NAME,
      title: "Learn Rust properly",
    });

    expect(updated).toEqual(["Ideas/2026-01-01-reference.md"]);
    const raw = await readFile(path.join(vault, "Ideas", "2026-01-01-reference.md"), "utf8");
    // The heading and the alias are the author's, and survive the rewrite untouched.
    expect(raw).toContain(
      "see [[Learn Rust properly]] and [[Learn Rust properly#Ship a CLI|the plan]]",
    );
    expect(raw).toContain("source: whatsapp");
  });

  it("keeps the shape a link was written in: a filename link gets the new filename", async () => {
    await put("Goals", NAME, RAW);
    await put(
      "Ideas",
      "2026-01-01-links.md",
      "---\ncreated: 2026-01-01T00:00:00.000Z\n---\n\n# Links\n\n[[Goals/2026-01-02-learn-rust.md]] and [the plan](2026-01-02-learn-rust.md#ship-a-cli)\n",
    );

    await renameNote(vault, { folder: "Goals", name: NAME, title: "Learn Rust properly" });

    const raw = await readFile(path.join(vault, "Ideas", "2026-01-01-links.md"), "utf8");
    expect(raw).toContain("[[Goals/2026-01-02-learn-rust-properly.md]]");
    // A markdown link keeps its text and its anchor.
    expect(raw).toContain("[the plan](2026-01-02-learn-rust-properly.md#ship-a-cli)");
  });

  it("leaves a link that points elsewhere, and links inside code, alone", async () => {
    await put("Goals", NAME, RAW);
    await put(
      "Ideas",
      "2026-01-01-unrelated.md",
      "---\ncreated: 2026-01-01T00:00:00.000Z\n---\n\n# Unrelated\n\n[[Some other note]]\n\n```md\n[[Learn Rust]]\n```\n\nand `[[Learn Rust]]` inline\n",
    );

    const { updated } = await renameNote(vault, {
      folder: "Goals",
      name: NAME,
      title: "Learn Rust properly",
    });

    expect(updated).toEqual([]);
    const raw = await readFile(path.join(vault, "Ideas", "2026-01-01-unrelated.md"), "utf8");
    expect(raw).toContain("[[Some other note]]");
    // A code sample is not a link: the rename has no business editing one.
    expect(raw).toContain("[[Learn Rust]]\n```");
    expect(raw).toContain("`[[Learn Rust]]` inline");
  });

  it("leaves an alias link as written, because an alias survives the rename", async () => {
    const withAlias = `---\nsource: desktop\ncreated: 2026-01-02T00:00:00.000Z\naliases:\n  - rust plan\ntags: []\n---\n\n# Learn Rust\n\nship a CLI\n`;
    await put("Goals", NAME, withAlias);
    await put(
      "Ideas",
      "2026-01-01-reference.md",
      "---\ncreated: 2026-01-01T00:00:00.000Z\n---\n\n# Reference\n\nsee [[rust plan]]\n",
    );

    const { updated } = await renameNote(vault, {
      folder: "Goals",
      name: NAME,
      title: "Learn Rust properly",
    });

    expect(updated).toEqual([]);
    const raw = await readFile(path.join(vault, "Ideas", "2026-01-01-reference.md"), "utf8");
    expect(raw).toContain("see [[rust plan]]");
  });

  it("leaves every linking note alone when the title is not changing", async () => {
    await put("Goals", NAME, RAW);
    await put(
      "Ideas",
      "2026-01-01-reference.md",
      "---\ncreated: 2026-01-01T00:00:00.000Z\n---\n\n# Reference\n\n[[Learn Rust]]\n",
    );

    const { updated } = await renameNote(vault, {
      folder: "Goals",
      name: NAME,
      title: "Learn Rust",
    });

    expect(updated).toEqual([]);
  });

  it("refuses an empty title, and renames nothing", async () => {
    await put("Goals", NAME, RAW);
    await expect(
      renameNote(vault, { folder: "Goals", name: NAME, title: "   " }),
    ).rejects.toMatchObject({ reason: "unsafe" });

    expect(await readdir(path.join(vault, "Goals"))).toEqual([NAME]);
  });

  it("refuses to take a name another note already holds", async () => {
    await put("Goals", NAME, RAW);
    await put("Goals", "2026-01-02-learn-rust-properly.md", RAW);

    await expect(
      renameNote(vault, { folder: "Goals", name: NAME, title: "Learn Rust properly" }),
    ).rejects.toMatchObject({ reason: "exists" });

    expect(await readdir(path.join(vault, "Goals"))).toHaveLength(2);
  });

  it("reports a note that is not there", async () => {
    await expect(
      renameNote(vault, { folder: "Ideas", name: "missing.md", title: "Anything" }),
    ).rejects.toMatchObject({ reason: "missing" });
  });
});

const DELETED_AT = new Date("2026-01-05T10:00:00.000Z");

/** A note in `Ideas`, deleted at a fixed moment so the trash entry is predictable. */
async function deleted(name = "2026-01-02-a.md"): Promise<{ id: string; file: string }> {
  const file = await put("Ideas", name, RAW);
  const entry = await deleteNote(vault, { folder: "Ideas", name }, { now: DELETED_AT });
  return { id: entry.id, file };
}

describe("deleteNote", () => {
  it("moves the note into the vault's trash and answers the entry", async () => {
    await put("Ideas", "2026-01-02-a.md", RAW);
    await put("Ideas", "2026-01-03-b.md", RAW);

    const entry = await deleteNote(
      vault,
      { folder: "Ideas", name: "2026-01-02-a.md" },
      { now: DELETED_AT },
    );

    expect(await readdir(path.join(vault, "Ideas"))).toEqual(["2026-01-03-b.md"]);
    expect(entry).toEqual({
      id: "2026-01-05T10-00-00-000Z",
      folder: "Ideas",
      name: "2026-01-02-a.md",
      deleted: "2026-01-05T10:00:00.000Z",
    });
    const kept = path.join(vault, ".trash", entry.id, "Ideas", "2026-01-02-a.md");
    expect(await readFile(kept, "utf8")).toBe(RAW);
  });

  it("gives two deletes in the same millisecond their own entry", async () => {
    await put("Ideas", "2026-01-02-a.md", RAW);
    await put("Ideas", "2026-01-02-b.md", RAW);

    const first = await deleteNote(
      vault,
      { folder: "Ideas", name: "2026-01-02-a.md" },
      { now: DELETED_AT },
    );
    const second = await deleteNote(
      vault,
      { folder: "Ideas", name: "2026-01-02-b.md" },
      { now: DELETED_AT },
    );

    expect(first.id).toBe("2026-01-05T10-00-00-000Z");
    expect(second.id).toBe("2026-01-05T10-00-00-000Z-2");
    expect(await readdir(path.join(vault, ".trash", second.id, "Ideas"))).toEqual([
      "2026-01-02-b.md",
    ]);
  });

  it("keeps the trash out of the listing and the graph", async () => {
    await put("Ideas", "2026-01-02-a.md", RAW);
    await put("Ideas", "2026-01-03-b.md", RAW);
    await deleteNote(vault, { folder: "Ideas", name: "2026-01-02-a.md" });

    const listed = await listNotes(vault);
    expect(listed.map((entry) => entry.name)).toEqual(["2026-01-03-b.md"]);
    expect(listed.every((entry) => entry.folder === "Ideas")).toBe(true);

    const { nodes } = await buildVaultGraph(vault);
    expect(nodes.filter((node) => node.kind === "note")).toHaveLength(1);
  });

  it("reports a note that is not there, and writes no entry", async () => {
    await expect(deleteNote(vault, { folder: "Ideas", name: "missing.md" })).rejects.toMatchObject({
      reason: "missing",
    });
    expect(await readdir(vault).catch(() => [])).not.toContain(".trash");
  });

  it("refuses a name that escapes the folder, and deletes nothing", async () => {
    const outside = await put("", "secret.md", "# Secret\n\ntop secret\n");
    await expect(
      deleteNote(vault, { folder: "Ideas", name: "../secret.md" }),
    ).rejects.toMatchObject({ reason: "unsafe" });

    expect(await readFile(outside, "utf8")).toContain("top secret");
  });
});

describe("restoreNote", () => {
  it("puts the note back where it was, byte for byte, and empties its trash entry", async () => {
    const { id, file } = await deleted();

    const note = await restoreNote(vault, id);

    expect(note.folder).toBe("Ideas");
    expect(note.file).toBe(file);
    expect(await readFile(file, "utf8")).toBe(RAW);
    expect(await readdir(path.join(vault, ".trash"))).toEqual([]);
    expect((await listNotes(vault)).map((entry) => entry.name)).toEqual(["2026-01-02-a.md"]);
  });

  it("refuses to overwrite a note that has taken the name again", async () => {
    const { id } = await deleted();
    await put("Ideas", "2026-01-02-a.md", "# Another note\n\nmine now\n");

    await expect(restoreNote(vault, id)).rejects.toMatchObject({ reason: "exists" });

    expect(await readFile(path.join(vault, "Ideas", "2026-01-02-a.md"), "utf8")).toContain(
      "mine now",
    );
    // The trashed copy is untouched, so the undo can be retried once the name is free again.
    expect(await readdir(path.join(vault, ".trash", id, "Ideas"))).toEqual(["2026-01-02-a.md"]);
  });

  it("reports an entry that is not in the trash", async () => {
    await expect(restoreNote(vault, "2026-01-05T10-00-00-000Z")).rejects.toMatchObject({
      reason: "missing",
    });
  });

  it("refuses an id that could reach outside the trash", async () => {
    await expect(restoreNote(vault, "../Ideas")).rejects.toMatchObject({ reason: "unsafe" });
    await expect(restoreNote(vault, "..")).rejects.toMatchObject({ reason: "unsafe" });
    await expect(restoreNote(vault, "/tmp")).rejects.toMatchObject({ reason: "unsafe" });
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

  it("lists a note with broken frontmatter instead of dropping it", async () => {
    // The two shapes that used to make the file disappear: YAML that does not parse, and a block
    // that is not a mapping.
    await put(
      "Inbox",
      "2026-05-01-unclosed.md",
      "---\nsource: [unclosed\n---\n\n# Unclosed\n\nstill here",
    );
    await put("Inbox", "2026-05-02-list.md", "---\n- one\n- two\n---\n\n# List\n\nstill here");

    const entries = await getNotesByFolder(vault, "Inbox");
    expect(entries.map((e) => e.title).sort()).toEqual(["List", "Unclosed"]);
    const unclosed = entries.find((e) => e.title === "Unclosed");
    expect(unclosed?.problems).toEqual(["frontmatter is not valid YAML"]);
    expect(unclosed?.excerpt).toBe("still here");
  });

  it("leaves problems off an entry that has none", async () => {
    await put(
      "Ideas",
      "2026-05-03-fine.md",
      serializeNote(defaultFrontmatter("whatsapp"), "# Fine\n\nbody"),
    );
    const [entry] = await getNotesByFolder(vault, "Ideas");
    expect(entry).not.toHaveProperty("problems");
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
