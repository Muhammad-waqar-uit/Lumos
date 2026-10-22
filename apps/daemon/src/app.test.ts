import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
