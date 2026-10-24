import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import { saveNote } from "@lumos/vault-utils";
import type { LinkCard, NoteInput } from "@lumos/shared";
import { LinkFetchError } from "./fetch-link";
import { createApp } from "./app";

// Every app in this file is built over a temporary vault and torn down again, so no test
// can reach the real vault. Routes that would fetch a page take an injected fetcher, so
// the suite makes no network request either.

const tempDirs: string[] = [];
const apps: FastifyInstance[] = [];

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/**
 * A fresh temp vault, seeded with the given notes, behind a real app.
 * `fetchLink` is injected only by the tests that need one.
 */
async function makeApp(
  seed: NoteInput[] = [],
  options: { fetchLink?: (url: string) => Promise<LinkCard> } = {},
): Promise<{ vault: string; app: FastifyInstance }> {
  const vault = await mkdtemp(path.join(tmpdir(), "lumos-routes-"));
  tempDirs.push(vault);
  for (const note of seed) await saveNote(vault, note);
  const app = await createApp({ vault, ...options });
  apps.push(app);
  return { vault, app };
}

const NOTE: NoteInput = {
  folder: "Ideas",
  text: "build a habit tracker\n\npairs with [[learn rust]] and [[ghost note]], tagged #ideas",
};

/** A page card, as the fetcher would return one after a successful scrape. */
function pageCard(url: string): LinkCard {
  return {
    media: { url, kind: "page" },
    title: "Example page",
    site: "example.com",
    description: "A description",
    image: null,
    text: "Readable body text.",
    truncated: false,
  };
}

describe("GET /health", () => {
  it("answers ok", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("POST /message", () => {
  it("asks for text when the body is empty", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "POST", url: "/message", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "text is required" });
  });

  it("answers a malformed message instead of crashing the daemon", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "POST", url: "/message", payload: { text: "/" } });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ reply: string }>().reply).toContain("Unknown command /");
  });

  it("files the note into the vault the app was given", async () => {
    const { app, vault } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/message",
      payload: { text: "/idea build a habit tracker" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reply: "Filed in Ideas: build a habit tracker" });

    // Written to the injected vault, which is the whole point of the factory.
    const written = await readdir(path.join(vault, "Ideas"));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/^\d{4}-\d{2}-\d{2}-build-a-habit-tracker\.md$/);
  });
});

describe("GET /notes", () => {
  it("lists a broken note with its problems instead of dropping it", async () => {
    const { vault, app } = await makeApp([NOTE]);
    await mkdir(path.join(vault, "Goals"), { recursive: true });
    await writeFile(
      path.join(vault, "Goals", "2026-05-02-unclosed.md"),
      "---\nsource: [x\n---\n\n# Unclosed\n",
    );

    const res = await app.inject({ method: "GET", url: "/notes" });
    const { notes } = res.json<{ notes: { title: string; problems?: string[] }[] }>();
    const broken = notes.find((n) => n.title === "Unclosed");
    expect(broken?.problems).toEqual(["frontmatter is not valid YAML"]);
    // A note that is fine carries no such field, so a clean listing stays unchanged.
    expect(notes.find((n) => n.title === "build a habit tracker")).not.toHaveProperty("problems");
  });

  it("lists the vault's notes with the fields the desktop renders", async () => {
    const { app } = await makeApp([NOTE, { folder: "Goals", text: "learn rust\n\nship a CLI" }]);
    const res = await app.inject({ method: "GET", url: "/notes" });

    expect(res.statusCode).toBe(200);
    const { notes } = res.json<{ notes: { title: string; folder: string; name: string }[] }>();
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.title).sort()).toEqual(["build a habit tracker", "learn rust"]);
    expect(notes.every((n) => n.name.endsWith(".md"))).toBe(true);
    expect(notes.map((n) => n.folder).sort()).toEqual(["Goals", "Ideas"]);
  });

  it("answers an empty vault with an empty list, not an error", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/notes" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ notes: [] });
  });
});

describe("GET /notes/search", () => {
  it("matches the body case-insensitively", async () => {
    const { app } = await makeApp([NOTE, { folder: "Goals", text: "learn rust" }]);
    const res = await app.inject({ method: "GET", url: "/notes/search?q=HABIT" });
    expect(res.statusCode).toBe(200);
    const { notes } = res.json<{ notes: { title: string }[] }>();
    expect(notes.map((n) => n.title)).toEqual(["build a habit tracker"]);
  });

  it("returns nothing for a blank query or no match", async () => {
    const { app } = await makeApp([NOTE]);
    for (const url of ["/notes/search", "/notes/search?q=", "/notes/search?q=quantum"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ notes: [] });
    }
  });
});

describe("POST /notes", () => {
  it("files the note, names it from the first line and stamps its origin", async () => {
    const { vault, app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { folder: "Ideas", text: "Book the flights #travel\n\nTwo weeks in October." },
    });

    expect(res.statusCode).toBe(200);
    const { note } = res.json<{
      note: {
        title: string;
        folder: string;
        file: string;
        frontmatter: { source: string; tags: string[] };
        content: string;
      };
    }>();
    expect(note.title).toBe("Book the flights #travel");
    expect(note.folder).toBe("Ideas");
    expect(path.dirname(note.file)).toBe(path.join(vault, "Ideas"));
    // Written by the app, so the note says so rather than claiming a WhatsApp capture.
    expect(note.frontmatter.source).toBe("desktop");
    // The capture writer's rules apply here too: the same tags, from the same function.
    expect(note.frontmatter.tags).toEqual(["travel"]);
    expect(note.content).toContain("Two weeks in October.");
  });

  it("appears in the listing afterwards", async () => {
    const { app } = await makeApp();
    await app.inject({
      method: "POST",
      url: "/notes",
      payload: { folder: "Goals", text: "Learn Rust" },
    });

    const res = await app.inject({ method: "GET", url: "/notes" });
    const { notes } = res.json<{ notes: { title: string; folder: string }[] }>();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: "Learn Rust", folder: "Goals" });
  });

  it("refuses a request without a folder or text, and one that is only spaces", async () => {
    const { app } = await makeApp();
    const cases = [
      { payload: {}, error: "folder and text are required" },
      { payload: { folder: "Ideas" }, error: "folder and text are required" },
      { payload: { text: "somewhere" }, error: "folder and text are required" },
      { payload: { folder: "Ideas", text: "   " }, error: "folder and text are required" },
    ];

    for (const { payload, error } of cases) {
      const res = await app.inject({ method: "POST", url: "/notes", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json(), JSON.stringify(payload)).toEqual({ error });
    }
  });

  it("refuses a folder outside the known set", async () => {
    const { vault, app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/notes",
      payload: { folder: "../secrets", text: "somewhere it does not belong" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "unknown folder" });
    // Nothing was written anywhere, including outside the vault.
    expect(await readdir(vault)).toEqual([]);
  });

  it("never overwrites: a second note with the same text gets its own file", async () => {
    const { vault, app } = await makeApp();
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: "POST",
        url: "/notes",
        payload: { folder: "Ideas", text: "Same title" },
      });
    }

    const written = await readdir(path.join(vault, "Ideas"));
    expect(written).toHaveLength(2);
    expect(new Set(written).size).toBe(2);
  });
});

describe("GET /folders", () => {
  it("counts every known folder, including the empty ones", async () => {
    const { app } = await makeApp([NOTE, { folder: "Ideas", text: "a second idea" }]);
    const res = await app.inject({ method: "GET", url: "/folders" });

    expect(res.statusCode).toBe(200);
    const { folders } = res.json<{ folders: { folder: string; count: number }[] }>();
    expect(folders.map((f) => f.folder)).toEqual([
      "Inbox",
      "Ideas",
      "Interviews",
      "Goals",
      "Reading",
    ]);
    expect(folders.find((f) => f.folder === "Ideas")?.count).toBe(2);
    expect(folders.find((f) => f.folder === "Goals")?.count).toBe(0);
  });
});

describe("GET /note", () => {
  it("refuses a request without both parameters", async () => {
    const { app } = await makeApp([NOTE]);
    for (const url of ["/note", "/note?folder=Ideas", "/note?name=anything.md"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "folder and name are required" });
    }
  });

  it("refuses a folder outside the known set", async () => {
    const { app } = await makeApp([NOTE]);
    const res = await app.inject({ method: "GET", url: "/note?folder=Secrets&name=x.md" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "unknown folder" });
  });

  it("refuses every traversal shape with a 400, never a file", async () => {
    const { vault, app } = await makeApp([NOTE]);
    // A decoy sitting outside any folder: if the guard ever goes, this is what leaks.
    await writeFile(path.join(vault, "secret.md"), "# Secret\n\ntop secret\n");

    const names = ["../secret.md", "..%2Fsecret.md", "sub/child.md", "sub\\child.md", "notes.txt"];
    for (const name of names) {
      const res = await app.inject({
        method: "GET",
        url: `/note?folder=Ideas&name=${encodeURIComponent(name)}`,
      });
      expect(res.statusCode, `name=${name}`).toBe(400);
      expect(res.json()).toEqual({ error: "invalid name" });
      expect(res.body, `name=${name}`).not.toContain("top secret");
    }
  });

  it("returns a real note with its frontmatter and body", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));

    const res = await app.inject({
      method: "GET",
      url: `/note?folder=Ideas&name=${encodeURIComponent(name)}`,
    });

    expect(res.statusCode).toBe(200);
    const { note } = res.json<{
      note: { title: string; folder: string; frontmatter: { source: string }; content: string };
    }>();
    expect(note.title).toBe("build a habit tracker");
    expect(note.folder).toBe("Ideas");
    expect(note.frontmatter.source).toBe("whatsapp");
    expect(note.content).toContain("[[learn rust]]");
  });

  it("answers 404 for a well-formed name that is not there", async () => {
    const { app } = await makeApp([NOTE]);
    const res = await app.inject({ method: "GET", url: "/note?folder=Ideas&name=missing.md" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "note not found" });
  });

  it("serves a note with broken frontmatter, problems and all", async () => {
    const { vault, app } = await makeApp();
    await mkdir(path.join(vault, "Ideas"), { recursive: true });
    await writeFile(
      path.join(vault, "Ideas", "2026-05-01-broken.md"),
      "---\ncreated: soon\n---\n\n# Broken\n\nstill here\n",
    );

    const res = await app.inject({
      method: "GET",
      url: "/note?folder=Ideas&name=2026-05-01-broken.md",
    });
    expect(res.statusCode).toBe(200);
    const { note } = res.json<{
      note: { title: string; content: string; problems: string[] };
    }>();
    expect(note.title).toBe("Broken");
    expect(note.content).toContain("still here");
    expect(note.problems).toEqual(["created is not a date"]);
  });
});

describe("PUT /note", () => {
  /** The single note `makeApp` filed into Ideas, by filename. */
  async function seededNote(vault: string): Promise<string> {
    const [name] = await readdir(path.join(vault, "Ideas"));
    return name;
  }

  it("saves the body and leaves the frontmatter the file already had", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seededNote(vault);

    const res = await app.inject({
      method: "PUT",
      url: "/note",
      payload: { folder: "Ideas", name, content: "# Edited title\n\nconsidered" },
    });

    expect(res.statusCode).toBe(200);
    const { note } = res.json<{ note: { title: string; content: string; problems: string[] } }>();
    expect(note.title).toBe("Edited title");
    expect(note.content).toBe("# Edited title\n\nconsidered");
    expect(note.problems).toEqual([]);

    const raw = await readFile(path.join(vault, "Ideas", name), "utf8");
    expect(raw).toContain("source: whatsapp");
    expect(raw).toContain("considered");
    expect(raw).not.toContain("pairs with");
  });

  it("accepts an empty body, meaning the text was deleted", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seededNote(vault);

    const res = await app.inject({
      method: "PUT",
      url: "/note",
      payload: { folder: "Ideas", name, content: "" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ note: { content: string } }>().note.content).toBe("");
    const raw = await readFile(path.join(vault, "Ideas", name), "utf8");
    // The block survives, so the note is still a note and its tags are still its tags.
    expect(raw).toContain("source: whatsapp");
  });

  it("refuses a request that names no note, no body, or a folder it does not know", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seededNote(vault);
    const cases = [
      { payload: {}, error: "folder and name are required" },
      { payload: { folder: "Ideas" }, error: "folder and name are required" },
      { payload: { folder: "Ideas", name, content: 7 }, error: "content is required" },
      // A missing body is not the same request as an empty one.
      { payload: { folder: "Ideas", name }, error: "content is required" },
      { payload: { folder: "Secrets", name, content: "x" }, error: "unknown folder" },
    ];

    for (const { payload, error } of cases) {
      const res = await app.inject({ method: "PUT", url: "/note", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json(), JSON.stringify(payload)).toEqual({ error });
    }
  });

  it("refuses every traversal shape with a 400 and leaves the file outside alone", async () => {
    const { vault, app } = await makeApp([NOTE]);
    await writeFile(path.join(vault, "secret.md"), "# Secret\n\ntop secret\n");
    const name = await seededNote(vault);

    const names = ["../secret.md", "sub/child.md", "sub\\child.md", "notes.txt", name];
    for (const bad of names) {
      // The last case is a valid name with `..` smuggled into it, which the guard must still refuse.
      const payload = {
        folder: "Ideas",
        name: bad === name ? `../${bad}` : bad,
        content: "# Pwned",
      };
      const res = await app.inject({ method: "PUT", url: "/note", payload });
      expect(res.statusCode, bad).toBe(400);
      expect(res.json(), bad).toEqual({ error: "invalid name" });
    }

    expect(await readFile(path.join(vault, "secret.md"), "utf8")).toContain("top secret");
  });

  it("answers 404 for a note that is not there, and writes nothing", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const res = await app.inject({
      method: "PUT",
      url: "/note",
      payload: { folder: "Goals", name: "2026-01-01-missing.md", content: "# New" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "note not found" });
    // A save never becomes a create behind the user's back.
    expect(await readdir(path.join(vault, "Goals")).catch(() => [])).toEqual([]);
  });

  it("leaves every other note untouched", async () => {
    const { vault, app } = await makeApp([{ folder: "Goals", text: "learn rust" }]);
    await mkdir(path.join(vault, "Ideas"), { recursive: true });
    const untouched =
      "---\nsource: desktop\ncreated: 2026-01-01T00:00:00.000Z\ntags: []\n---\n\n# Neighbour\n\nkeep me\n";
    await writeFile(path.join(vault, "Ideas", "2026-01-01-neighbour.md"), untouched);
    await writeFile(path.join(vault, "Ideas", "2026-01-02-target.md"), untouched);

    const res = await app.inject({
      method: "PUT",
      url: "/note",
      payload: { folder: "Ideas", name: "2026-01-02-target.md", content: "# Target\n\nrewritten" },
    });

    expect(res.statusCode).toBe(200);
    expect(await readFile(path.join(vault, "Ideas", "2026-01-01-neighbour.md"), "utf8")).toBe(
      untouched,
    );
  });
});

describe("PATCH /note", () => {
  /** The single note `makeApp` filed into Ideas, by filename. */
  async function seededNote(vault: string): Promise<string> {
    const [name] = await readdir(path.join(vault, "Ideas"));
    return name;
  }

  it("renames the file after the title and answers the note as it now reads", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seededNote(vault);

    const res = await app.inject({
      method: "PATCH",
      url: "/note",
      payload: { folder: "Ideas", name, title: "Habit tracker, eventually" },
    });

    expect(res.statusCode).toBe(200);
    const { note, updated } = res.json<{
      note: { title: string; file: string; content: string };
      updated: string[];
    }>();
    // Nothing else in this vault links here, so nothing else was edited.
    expect(updated).toEqual([]);
    expect(note.title).toBe("Habit tracker, eventually");
    expect(path.basename(note.file)).toMatch(/^\d{4}-\d{2}-\d{2}-habit-tracker-eventually\.md$/);
    // The heading the title comes from says the same thing as the filename.
    expect(note.content.split("\n")[0]).toBe("# Habit tracker, eventually");
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([path.basename(note.file)]);
  });

  it("refuses a request with no title, no name, or a folder it does not know", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seededNote(vault);
    const cases = [
      { payload: {}, error: "folder and name are required" },
      { payload: { folder: "Ideas", name }, error: "title is required" },
      { payload: { folder: "Ideas", name, title: "  " }, error: "title is required" },
      { payload: { folder: "Secrets", name, title: "x" }, error: "unknown folder" },
      { payload: { folder: "Ideas", name: "../secret.md", title: "x" }, error: "invalid name" },
    ];

    for (const { payload, error } of cases) {
      const res = await app.inject({ method: "PATCH", url: "/note", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json(), JSON.stringify(payload)).toEqual({ error });
    }

    // Nothing was renamed by a refused request.
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([name]);
  });

  it("answers 404 for a note that is not there, and creates nothing", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const res = await app.inject({
      method: "PATCH",
      url: "/note",
      payload: { folder: "Goals", name: "2026-01-01-missing.md", title: "Anything" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "note not found" });
    expect(await readdir(path.join(vault, "Goals")).catch(() => [])).toEqual([]);
  });

  it("answers 409 when another note already has the name, and keeps both", async () => {
    const { vault, app } = await makeApp([NOTE]);
    // A capture is filed under today's date, which is the prefix a rename keeps - so a note with
    // this title would land on this filename.
    const stamp = new Date().toISOString().slice(0, 10);
    const taken =
      "---\nsource: desktop\ncreated: 2026-01-01T00:00:00.000Z\n---\n\n# Taken\n\nthe other one\n";
    await writeFile(path.join(vault, "Ideas", `${stamp}-taken.md`), taken);

    const [name] = (await readdir(path.join(vault, "Ideas"))).filter(
      (entry) => entry !== `${stamp}-taken.md`,
    );
    const res = await app.inject({
      method: "PATCH",
      url: "/note",
      payload: { folder: "Ideas", name, title: "Taken" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "a note with that name already exists" });
    // The note that held the name is untouched, and the one being renamed is still there.
    expect(await readFile(path.join(vault, "Ideas", `${stamp}-taken.md`), "utf8")).toBe(taken);
    expect(await readdir(path.join(vault, "Ideas"))).toHaveLength(2);
  });

  it("rewrites the links other notes have to the old title", async () => {
    const { vault, app } = await makeApp([
      NOTE,
      { folder: "Goals", text: "follow [[build a habit tracker]] closely" },
    ]);
    const [name] = await readdir(path.join(vault, "Ideas"));

    const res = await app.inject({
      method: "PATCH",
      url: "/note",
      payload: { folder: "Ideas", name, title: "Habit tracker, eventually" },
    });

    expect(res.statusCode).toBe(200);
    const { updated } = res.json<{ updated: string[] }>();
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatch(/^Goals\/.+\.md$/);

    const linking = await readFile(path.join(vault, ...updated[0].split("/")), "utf8");
    expect(linking).toContain("[[Habit tracker, eventually]]");
    expect(linking).not.toContain("[[build a habit tracker]]");
  });

  it("treats a rename to the title it already has as no change at all", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));

    const res = await app.inject({
      method: "PATCH",
      url: "/note",
      payload: { folder: "Ideas", name, title: "build a habit tracker" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ note: { file: string } }>().note.file.endsWith(name)).toBe(true);
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([name]);
  });
});

describe("PATCH /note/meta", () => {
  /** The seeded note's filename, which the route needs. */
  async function seeded(vault: string): Promise<string> {
    const [name] = await readdir(path.join(vault, "Ideas"));
    return name;
  }

  it("writes the tags and answers the note as it now reads", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seeded(vault);

    const res = await app.inject({
      method: "PATCH",
      url: "/note/meta",
      payload: { folder: "Ideas", name, tags: ["Rust", "#cli"] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ note: { frontmatter: { tags: string[] } } }>().note.frontmatter.tags).toEqual(
      ["rust", "cli"],
    );
  });

  it("changes the status without losing the tags, and leaves the body as written", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seeded(vault);
    const before = await readFile(path.join(vault, "Ideas", name), "utf8");

    const res = await app.inject({
      method: "PATCH",
      url: "/note/meta",
      payload: { folder: "Ideas", name, status: "done" },
    });

    expect(res.statusCode).toBe(200);
    const after = await readFile(path.join(vault, "Ideas", name), "utf8");
    expect(after).toContain("status: done");
    expect(after).toContain("tags:\n  - ideas");
    // The body is everything after the block, and it is untouched.
    expect(after.slice(after.indexOf("\n---", 3))).toBe(before.slice(before.indexOf("\n---", 3)));
  });

  it("refuses a request with nothing to change, a bad tag list, or a bad status", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seeded(vault);
    const cases = [
      { payload: { folder: "Ideas", name }, error: "tags or status is required" },
      { payload: { folder: "Ideas", name, tags: "rust" }, error: "tags must be a list of strings" },
      { payload: { folder: "Ideas", name, tags: [1] }, error: "tags must be a list of strings" },
      { payload: { folder: "Ideas", name, status: 4 }, error: "status must be a string" },
      { payload: { folder: "Secrets", name, tags: [] }, error: "unknown folder" },
      { payload: { folder: "Ideas", name: "../a.md", tags: [] }, error: "invalid name" },
    ];

    for (const { payload, error } of cases) {
      const res = await app.inject({ method: "PATCH", url: "/note/meta", payload });
      expect(res.statusCode, error).toBe(400);
      expect(res.json(), error).toEqual({ error });
    }
  });

  it("answers 400 for a block it cannot read, and 404 for a note that is not there", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const name = await seeded(vault);
    await writeFile(path.join(vault, "Ideas", name), "---\ntags: [unclosed\n---\n\n# Broken\n");

    const broken = await app.inject({
      method: "PATCH",
      url: "/note/meta",
      payload: { folder: "Ideas", name, tags: ["x"] },
    });
    expect(broken.statusCode).toBe(400);
    expect(broken.json()).toEqual({ error: "this note's frontmatter is not valid YAML" });

    const gone = await app.inject({
      method: "PATCH",
      url: "/note/meta",
      payload: { folder: "Ideas", name: "2026-01-01-missing.md", tags: [] },
    });
    expect(gone.statusCode).toBe(404);
    expect(gone.json()).toEqual({ error: "note not found" });
  });
});

describe("POST /note/move", () => {
  it("moves the note into the other folder and answers it there", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));

    const res = await app.inject({
      method: "POST",
      url: "/note/move",
      payload: { folder: "Ideas", name, toFolder: "Goals" },
    });

    expect(res.statusCode).toBe(200);
    const { note } = res.json<{ note: { folder: string; title: string; file: string } }>();
    expect(note.folder).toBe("Goals");
    expect(note.title).toBe("build a habit tracker");
    expect(await readdir(path.join(vault, "Goals"))).toEqual([name]);
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([]);
  });

  it("refuses a request that names no folder, or a folder it does not know", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));
    const cases = [
      { payload: {}, error: "folder, name and toFolder are required" },
      { payload: { folder: "Ideas", name }, error: "folder, name and toFolder are required" },
      { payload: { folder: "Ideas", name, toFolder: "Secrets" }, error: "unknown folder" },
      {
        payload: { folder: "Ideas", name: "../secret.md", toFolder: "Goals" },
        error: "invalid name",
      },
    ];

    for (const { payload, error } of cases) {
      const res = await app.inject({ method: "POST", url: "/note/move", payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json(), JSON.stringify(payload)).toEqual({ error });
    }

    expect(await readdir(path.join(vault, "Ideas"))).toEqual([name]);
  });

  it("answers 409 instead of replacing a note that is already in the folder", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));
    await mkdir(path.join(vault, "Goals"), { recursive: true });
    const existing =
      "---\nsource: desktop\ncreated: 2026-01-01T00:00:00.000Z\n---\n\n# Already here\n";
    await writeFile(path.join(vault, "Goals", name), existing);

    const res = await app.inject({
      method: "POST",
      url: "/note/move",
      payload: { folder: "Ideas", name, toFolder: "Goals" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "a note with that name already exists" });
    expect(await readFile(path.join(vault, "Goals", name), "utf8")).toBe(existing);
  });

  it("answers 404 for a note that is not there", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/note/move",
      payload: { folder: "Ideas", name: "2026-01-01-missing.md", toFolder: "Goals" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "note not found" });
  });
});

describe("DELETE /note", () => {
  it("moves the note to the trash and answers the entry an undo needs", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));

    const res = await app.inject({
      method: "DELETE",
      url: `/note?folder=Ideas&name=${encodeURIComponent(name)}`,
    });

    expect(res.statusCode).toBe(200);
    const { trash } = res.json<{ trash: { id: string; folder: string; name: string } }>();
    expect(trash).toMatchObject({ folder: "Ideas", name });
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([]);
    expect(await readFile(path.join(vault, ".trash", trash.id, "Ideas", name), "utf8")).toContain(
      "habit tracker",
    );
  });

  it("refuses a request that names no note, an unknown folder, or a bad name", async () => {
    const { app } = await makeApp([NOTE]);
    const cases = [
      { url: "/note", error: "folder and name are required" },
      { url: "/note?folder=Ideas", error: "folder and name are required" },
      { url: "/note?folder=Secrets&name=a.md", error: "unknown folder" },
      { url: "/note?folder=Ideas&name=../secret.md", error: "invalid name" },
    ];

    for (const { url, error } of cases) {
      const res = await app.inject({ method: "DELETE", url });
      expect(res.statusCode, url).toBe(400);
      expect(res.json(), url).toEqual({ error });
    }
  });

  it("answers 404 for a note that is not there", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/note?folder=Ideas&name=2026-01-01-missing.md",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "note not found" });
  });
});

describe("POST /note/restore", () => {
  /** Delete the seeded note through the route, and answer what an undo would send. */
  async function deleted(app: FastifyInstance, vault: string) {
    const [name] = await readdir(path.join(vault, "Ideas"));
    const res = await app.inject({
      method: "DELETE",
      url: `/note?folder=Ideas&name=${encodeURIComponent(name)}`,
    });
    return { id: res.json<{ trash: { id: string } }>().trash.id, name };
  }

  it("puts the note back and answers it as the vault now reads it", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const { id, name } = await deleted(app, vault);

    const res = await app.inject({ method: "POST", url: "/note/restore", payload: { id } });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ note: { folder: string; title: string } }>().note).toMatchObject({
      folder: "Ideas",
      title: "build a habit tracker",
    });
    expect(await readdir(path.join(vault, "Ideas"))).toEqual([name]);
  });

  it("refuses a name that has been taken again", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const { id, name } = await deleted(app, vault);
    await writeFile(path.join(vault, "Ideas", name), "# Another\n\nmine now\n", "utf8");

    const res = await app.inject({ method: "POST", url: "/note/restore", payload: { id } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "a note with that name already exists" });
    expect(await readFile(path.join(vault, "Ideas", name), "utf8")).toContain("mine now");
  });

  it("answers 400 with no id, and 404 for an entry that is not there", async () => {
    const { app } = await makeApp();

    const empty = await app.inject({ method: "POST", url: "/note/restore", payload: {} });
    expect(empty.statusCode).toBe(400);
    expect(empty.json()).toEqual({ error: "id is required" });

    const gone = await app.inject({
      method: "POST",
      url: "/note/restore",
      payload: { id: "2026-01-05T10-00-00-000Z" },
    });
    expect(gone.statusCode).toBe(404);
    expect(gone.json()).toEqual({ error: "that deleted note is no longer in the trash" });
  });

  it("refuses an id that could reach outside the trash", async () => {
    const { app } = await makeApp([NOTE]);
    const res = await app.inject({
      method: "POST",
      url: "/note/restore",
      payload: { id: "../Ideas" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "that is not a trash entry" });
  });
});

describe("GET /trash", () => {
  it("answers nothing for a vault with no deletes", async () => {
    const { app } = await makeApp([NOTE]);

    const res = await app.inject({ method: "GET", url: "/trash" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ trash: [] });
  });

  it("lists a deleted note with where it came from, and each entry restores", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));
    await app.inject({
      method: "DELETE",
      url: `/note?folder=Ideas&name=${encodeURIComponent(name)}`,
    });

    const res = await app.inject({ method: "GET", url: "/trash" });

    const entries = res.json<{ trash: { id: string; folder: string; name: string }[] }>().trash;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ folder: "Ideas", name });
    // The listing's own id is what the restore route takes, so the panel needs no second lookup.
    const restored = await app.inject({
      method: "POST",
      url: "/note/restore",
      payload: { id: entries[0].id },
    });
    expect(restored.statusCode).toBe(200);
  });
});

describe("DELETE /trash", () => {
  it("removes every deleted note, reports the count, and leaves the rest of the vault alone", async () => {
    const { vault, app } = await makeApp([NOTE]);
    const [name] = await readdir(path.join(vault, "Ideas"));
    await app.inject({
      method: "DELETE",
      url: `/note?folder=Ideas&name=${encodeURIComponent(name)}`,
    });

    const res = await app.inject({ method: "DELETE", url: "/trash" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ removed: 1 });
    expect(await readdir(path.join(vault, ".trash"))).toEqual([]);
    // The folder counts still describe the vault as it reads now.
    const folders = await app.inject({ method: "GET", url: "/folders" });
    expect(folders.json<{ folders: { folder: string; count: number }[] }>().folders).toContainEqual(
      {
        folder: "Ideas",
        count: 0,
      },
    );
  });

  it("answers zero when there is nothing to remove", async () => {
    const { app } = await makeApp([NOTE]);

    const res = await app.inject({ method: "DELETE", url: "/trash" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ removed: 0 });
  });
});

describe("GET /graph", () => {
  it("returns notes and tags as nodes, with unresolved links reported", async () => {
    const { app } = await makeApp([NOTE, { folder: "Goals", text: "learn rust" }]);
    const res = await app.inject({ method: "GET", url: "/graph" });

    expect(res.statusCode).toBe(200);
    const { graph } = res.json<{
      graph: {
        nodes: { id: string; kind: string }[];
        edges: { source: string; target: string; kind: string }[];
        unresolved: { target: string }[];
      };
    }>();

    expect(graph.nodes.filter((n) => n.kind === "tag").map((n) => n.id)).toContain("#ideas");
    expect(graph.edges.some((e) => e.kind === "link")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "tag")).toBe(true);
    // The link with no note behind it is reported, not invented as a node.
    expect(graph.unresolved.map((u) => u.target)).toContain("ghost note");
    expect(graph.nodes.some((n) => n.id.includes("ghost"))).toBe(false);
  });

  it("answers an empty vault with an empty graph", async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: "GET", url: "/graph" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ graph: { nodes: [], edges: [], unresolved: [] } });
  });
});

describe("GET /link", () => {
  // These use the real fetcher: each one is refused before a socket is opened, which is
  // exactly why they can be tested here instead of with curl.
  it("refuses a missing url, a non-http scheme, credentials and a local address", async () => {
    const { app } = await makeApp();
    const cases = [
      { url: "/link", error: "url is required" },
      { url: "/link?url=ftp%3A%2F%2Fexample.com%2Fx", error: "Only http and https links" },
      { url: "/link?url=http%3A%2F%2Fuser%3Apass%40example.com%2F", error: "username or password" },
      {
        url: "/link?url=http%3A%2F%2Flocalhost%3A3210%2Fnotes",
        error: "this machine or the local network",
      },
      { url: "/link?url=http%3A%2F%2F127.0.0.1%2F", error: "this machine or the local network" },
      {
        url: "/link?url=http%3A%2F%2F192.168.1.10%2Frouter",
        error: "this machine or the local network",
      },
    ];

    for (const { url, error } of cases) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(400);
      expect(res.json<{ error: string }>().error, url).toContain(error);
    }
  });

  it("returns the card the fetcher produced", async () => {
    const { app } = await makeApp([], { fetchLink: async (url) => pageCard(url) });
    const res = await app.inject({
      method: "GET",
      url: "/link?url=https%3A%2F%2Fexample.com%2Fpost",
    });

    expect(res.statusCode).toBe(200);
    const { link } = res.json<{ link: LinkCard }>();
    expect(link.title).toBe("Example page");
    expect(link.text).toBe("Readable body text.");
    expect(link.media.kind).toBe("page");
  });

  it("maps a fetcher failure to a 502 with the fetcher's own message", async () => {
    const failures = [
      new LinkFetchError("unreachable", "That page could not be reached."),
      new LinkFetchError("not-a-page", "That link is not a web page (application/pdf)."),
      new LinkFetchError("too-many-redirects", "That link redirected more than 3 times."),
    ];

    for (const failure of failures) {
      const { app } = await makeApp([], {
        fetchLink: async () => {
          throw failure;
        },
      });
      const res = await app.inject({
        method: "GET",
        url: "/link?url=https%3A%2F%2Fexample.com%2Fpost",
      });
      expect(res.statusCode, failure.message).toBe(502);
      expect(res.json()).toEqual({ error: failure.message });
    }
  });

  it("answers an unexpected failure with a generic message and no stack trace", async () => {
    const { app } = await makeApp([], {
      fetchLink: async () => {
        throw new TypeError("some internal detail at /home/user/app.ts:12");
      },
    });
    const res = await app.inject({ method: "GET", url: "/link?url=https%3A%2F%2Fexample.com%2F" });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: "That link could not be opened." });
    expect(res.body).not.toContain("TypeError");
    expect(res.body).not.toContain("app.ts");
  });
});

describe("unexpected route failures", () => {
  /**
   * A vault that is a file rather than a directory is the honest way to make a route throw
   * for a reason no route anticipates: `readdir` answers ENOTDIR, and the message of that
   * error carries the absolute path it failed on.
   */
  async function appOverAFile(): Promise<{ notADirectory: string; app: FastifyInstance }> {
    const dir = await mkdtemp(path.join(tmpdir(), "lumos-routes-"));
    tempDirs.push(dir);
    const notADirectory = path.join(dir, "vault.md");
    await writeFile(notADirectory, "not a vault");
    const app = await createApp({ vault: notADirectory });
    apps.push(app);
    return { notADirectory, app };
  }

  it("answers a plain 500 without the path the error carries", async () => {
    const { notADirectory, app } = await appOverAFile();
    const res = await app.inject({ method: "GET", url: "/notes" });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "The daemon could not finish that request." });
    // The vault path and the Node error stay out of the reply.
    expect(res.body).not.toContain("vault.md");
    expect(res.body).not.toContain(notADirectory);
    expect(res.body).not.toContain("ENOTDIR");
  });

  it("still names the cause of a 4xx it raised itself", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/message",
      headers: { "content-type": "application/json" },
      payload: "{oops",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBeTruthy();
    expect(res.json<{ error: string }>().error).not.toBe(
      "The daemon could not finish that request.",
    );
  });
});

describe("CORS", () => {
  it("allows the dev server and the Tauri origin", async () => {
    const { app } = await makeApp();
    for (const origin of ["http://localhost:1420", "http://127.0.0.1:1420", "tauri://localhost"]) {
      const res = await app.inject({ method: "GET", url: "/health", headers: { origin } });
      expect(res.headers["access-control-allow-origin"], origin).toBe(origin);
    }
  });

  it("lets the desktop's own origin send a PUT in a preflight", async () => {
    const { app } = await makeApp();
    // A JSON PUT is not a simple request, so the browser asks first and only sends the save if the
    // answer names PUT. Without this the route is unreachable from the app while curl still works.
    const res = await app.inject({
      method: "OPTIONS",
      url: "/note",
      headers: {
        origin: "http://localhost:1420",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:1420");
    expect(res.headers["access-control-allow-methods"]).toContain("PUT");
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain(
      "content-type",
    );
  });

  it("lets the desktop send the file operations in a preflight", async () => {
    const { app } = await makeApp();
    // A PATCH and a DELETE are not simple requests either: a method the allow-list omits is a
    // rename the browser refuses while curl succeeds.
    for (const method of ["PATCH", "DELETE"]) {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/note",
        headers: {
          origin: "http://localhost:1420",
          "access-control-request-method": method,
          "access-control-request-headers": "content-type",
        },
      });

      expect(res.statusCode, method).toBe(204);
      expect(res.headers["access-control-allow-methods"], method).toContain(method);
    }
  });

  it("does not echo a foreign origin", async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://evil.example" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
