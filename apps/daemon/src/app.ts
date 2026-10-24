/**
 * The daemon's HTTP surface, built as a factory rather than at import time.
 *
 * Two reasons it is a factory. The routes can be exercised without binding a port, so
 * `app.inject()` reaches them in the test suite. And everything they touch arrives as an
 * argument - the vault directory and the link fetcher - so no request can reach the real
 * vault or the network by accident.
 */
import path from "node:path";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  NoteFileError,
  buildVaultGraph,
  createNoteSearch,
  deleteNote,
  emptyTrash,
  getNotesByFolder,
  listNotes,
  listTrash,
  moveNote,
  readNote,
  renameNote,
  restoreNote,
  saveNote,
  updateNote,
  updateNoteMeta,
} from "@lumos/vault-utils";
import { FOLDERS, type Folder, type LinkCard } from "@lumos/shared";
import { LinkFetchError, fetchLinkCard } from "./fetch-link.js";
import { handleMessage } from "./handler.js";
import type { PlanOptions } from "./plan.js";

/**
 * A note filename the routes will touch: a plain `.md` name with no separators and no `..`.
 *
 * Reading is guarded against traversal and writing is guarded by the same rule, because a name that
 * could escape its folder is a file disclosure on one route and a file overwrite on the other.
 */
function isNoteName(name: string): boolean {
  return (
    name.endsWith(".md") && !name.includes("/") && !name.includes("\\") && !name.includes("..")
  );
}

/**
 * Turn a vault refusal into the answer it deserves, or null when it is not one of ours.
 *
 * An unsafe path is the request's fault (`400`), a note that is not there is a `404`, and a name
 * another note already holds is a `409` - the caller has to rename something before it can
 * succeed, and a `400` would suggest the request was malformed when it was only unlucky.
 */
function noteRefusal(err: unknown): { status: number; message: string } | null {
  if (!(err instanceof NoteFileError)) return null;
  const status = err.reason === "missing" ? 404 : err.reason === "exists" ? 409 : 400;
  return { status, message: err.message };
}

export interface AppOptions {
  /** Vault root that every route reads, and `/message` writes into. */
  vault: string;
  /** Request logging. Off in tests, so a passing run stays quiet. */
  logger?: boolean;
  /** Injected by tests so the suite never reaches the network. */
  fetchLink?: (url: string) => Promise<LinkCard>;
  /** The Ollama `/plan` answers from, handed down rather than read here. */
  plan?: PlanOptions;
}

export async function createApp({
  vault,
  logger = false,
  fetchLink = fetchLinkCard,
  plan,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  // Local-only dev origins (Vite dev server + Tauri). The server binds to 127.0.0.1.
  //
  // The methods are listed because the plugin's default is `GET,HEAD,POST`: a browser asks in a
  // preflight, is told PUT is not allowed, and the save fails in the app with only "Failed to fetch"
  // to show for it. Only what the routes actually offer is allowed.
  await app.register(cors, {
    origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /^tauri:\/\//],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  /**
   * One place decides what a failure says. The routes answer their own refusals with a
   * sentence that names the cause; this catches the rest - a filesystem error, say - and
   * answers a plain 500. The raw message is neither sent nor logged, because a Node error
   * carries the absolute path it failed on and the vault path stays out of both.
   *
   * A 4xx Fastify raised itself (malformed JSON, an unhandled method) keeps its own message:
   * that one is about the request and names nothing on disk.
   */
  app.setErrorHandler<FastifyError>((err, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status < 500) return reply.code(status).send({ error: err.message });

    req.log.error({ name: err.name, code: err.code }, "route failed unexpectedly");
    return reply.code(500).send({ error: "The daemon could not finish that request." });
  });

  // One search index for the life of the app, so the palette's repeated queries stat the vault and
  // scan memory instead of re-reading every note body on each pause in typing.
  const search = createNoteSearch(vault);

  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: { text?: string } }>("/message", async (req, reply) => {
    const text = req.body?.text;
    if (!text) return reply.code(400).send({ error: "text is required" });
    return { reply: await handleMessage(text, vault, { plan }) };
  });

  /** List every note in the vault, newest first. */
  app.get("/notes", async () => ({ notes: await listNotes(vault) }));

  /** Case-insensitive search across titles, content, and tags, from the app's warm index. */
  app.get<{ Querystring: { q?: string } }>("/notes/search", async (req) => {
    return { notes: await search.search(req.query.q ?? "") };
  });

  /**
   * One link, as the desktop shows it: whatever can be played inline, plus the page's
   * readable text. The URL is untrusted, so the fetcher refuses anything that is not a
   * public http(s) page. A refusal is a 400 with a message, never a stack trace.
   */
  app.get<{ Querystring: { url?: string } }>("/link", async (req, reply) => {
    const url = (req.query.url ?? "").trim();
    if (!url) return reply.code(400).send({ error: "url is required" });

    try {
      return { link: await fetchLink(url) };
    } catch (err: unknown) {
      if (err instanceof LinkFetchError) {
        const refused = err.code === "unsupported" || err.code === "blocked";
        return reply.code(refused ? 400 : 502).send({ error: err.message });
      }
      // Log the failure, not the link: a URL can carry private detail.
      req.log.error({ err }, "link fetch failed");
      return reply.code(502).send({ error: "That link could not be opened." });
    }
  });

  /** The vault's link graph: notes, internal links, tags, and links with no target yet. */
  app.get("/graph", async () => ({ graph: await buildVaultGraph(vault) }));

  /** Note counts per vault folder. */
  app.get("/folders", async () => {
    const groups = await Promise.all(
      FOLDERS.map(async (folder) => ({
        folder,
        count: (await getNotesByFolder(vault, folder)).length,
      })),
    );
    return { folders: groups };
  });

  /**
   * Create a note in a folder, and answer it as the vault now reads it.
   *
   * This is the desktop's capture path: the same writer WhatsApp uses, minus the command parsing
   * and minus the allowlist, which belongs to WhatsApp and not to the machine you are sitting at.
   * The note is stamped `source: desktop` so the viewer can tell the two apart - the field is shown
   * to the person reading the note, and a note that lies about its origin is worse than one that
   * says nothing.
   */
  app.post<{ Body: { folder?: string; text?: string } }>("/notes", async (req, reply) => {
    const { folder, text } = req.body ?? {};
    if (!folder || !text?.trim())
      return reply.code(400).send({ error: "folder and text are required" });
    if (!FOLDERS.includes(folder as Folder))
      return reply.code(400).send({ error: "unknown folder" });

    const createdFolder = folder as Folder;
    const { file } = await saveNote(
      vault,
      { folder: createdFolder, text: text.trim() },
      {
        source: "desktop",
      },
    );
    return { note: await readNote(file, createdFolder) };
  });

  /** Read a single note by folder + filename. */
  app.get<{ Querystring: { folder?: string; name?: string } }>("/note", async (req, reply) => {
    const { folder, name } = req.query;
    if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
    if (!FOLDERS.includes(folder as Folder))
      return reply.code(400).send({ error: "unknown folder" });
    if (!isNoteName(name)) return reply.code(400).send({ error: "invalid name" });
    try {
      return { note: await readNote(path.join(vault, folder, name), folder) };
    } catch {
      return reply.code(404).send({ error: "note not found" });
    }
  });

  /**
   * Save an edited body back into an existing note.
   *
   * Only the body is written: the frontmatter block is left exactly as the file has it, so an
   * invalid or hand-tuned block cannot be silently rewritten by an edit. The note must already
   * exist - this route never creates one - and an empty body is allowed, because deleting text is
   * an edit like any other.
   */
  app.put<{ Body: { folder?: string; name?: string; content?: string } }>(
    "/note",
    async (req, reply) => {
      const { folder, name, content } = req.body ?? {};
      if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
      // A missing body and an empty one are different requests: the second means "delete the text".
      if (typeof content !== "string")
        return reply.code(400).send({ error: "content is required" });
      if (!FOLDERS.includes(folder as Folder))
        return reply.code(400).send({ error: "unknown folder" });
      if (!isNoteName(name)) return reply.code(400).send({ error: "invalid name" });

      try {
        return { note: await updateNote(vault, { folder, name, content }) };
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT")
          return reply.code(404).send({ error: "note not found" });
        throw err;
      }
    },
  );

  /**
   * Rename a note to a new title.
   *
   * The title is the note's, not the file's: the file is renamed after it and the body's first
   * heading is rewritten to match, so nothing in the app disagrees about what the note is called.
   * A note with no heading keeps its body and only the filename changes.
   *
   * The links that pointed at the old title are rewritten in the notes that carried them, and the
   * files touched come back as `updated` - a link resolves by title, so leaving them would break
   * every backlink in the vault without saying so.
   */
  app.patch<{ Body: { folder?: string; name?: string; title?: string } }>(
    "/note",
    async (req, reply) => {
      const { folder, name, title } = req.body ?? {};
      if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
      if (!title?.trim()) return reply.code(400).send({ error: "title is required" });
      if (!FOLDERS.includes(folder as Folder))
        return reply.code(400).send({ error: "unknown folder" });
      if (!isNoteName(name)) return reply.code(400).send({ error: "invalid name" });

      try {
        const { note, updated } = await renameNote(vault, { folder, name, title });
        return { note, updated };
      } catch (err: unknown) {
        const refusal = noteRefusal(err);
        if (refusal) return reply.code(refusal.status).send({ error: refusal.message });
        throw err;
      }
    },
  );

  /**
   * Change a note's tags or status in place, and answer it as the vault now reads it.
   *
   * This is the one edit a body write cannot make: tags and status live in the frontmatter, and the
   * body is left exactly as it was. Only the fields that were sent change, so removing a tag never
   * touches the status, and an unknown key another tool wrote in the block survives.
   */
  app.patch<{ Body: { folder?: string; name?: string; tags?: string[]; status?: string } }>(
    "/note/meta",
    async (req, reply) => {
      const { folder, name, tags, status } = req.body ?? {};
      if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
      if (!FOLDERS.includes(folder as Folder))
        return reply.code(400).send({ error: "unknown folder" });
      if (!isNoteName(name)) return reply.code(400).send({ error: "invalid name" });

      if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")))
        return reply.code(400).send({ error: "tags must be a list of strings" });
      if (status !== undefined && typeof status !== "string")
        return reply.code(400).send({ error: "status must be a string" });
      if (tags === undefined && status === undefined)
        return reply.code(400).send({ error: "tags or status is required" });

      try {
        return { note: await updateNoteMeta(vault, { folder, name }, { tags, status }) };
      } catch (err: unknown) {
        const refusal = noteRefusal(err);
        if (refusal) return reply.code(refusal.status).send({ error: refusal.message });
        throw err;
      }
    },
  );

  /**
   * Move a note into another folder, under the name it already has.
   *
   * The filename is kept on purpose: the date in it is the note's, and a move is about where the
   * note belongs rather than what it is. Moving to the folder it is already in answers the note.
   */
  app.post<{ Body: { folder?: string; name?: string; toFolder?: string } }>(
    "/note/move",
    async (req, reply) => {
      const { folder, name, toFolder } = req.body ?? {};
      if (!folder || !name || !toFolder)
        return reply.code(400).send({ error: "folder, name and toFolder are required" });
      if (!FOLDERS.includes(folder as Folder) || !FOLDERS.includes(toFolder as Folder))
        return reply.code(400).send({ error: "unknown folder" });
      if (!isNoteName(name)) return reply.code(400).send({ error: "invalid name" });

      try {
        return {
          note: await moveNote(vault, {
            from: { folder, name },
            to: { folder: toFolder, name },
          }),
        };
      } catch (err: unknown) {
        const refusal = noteRefusal(err);
        if (refusal) return reply.code(refusal.status).send({ error: refusal.message });
        throw err;
      }
    },
  );

  /**
   * Remove a note from the vault by moving it into the vault's trash.
   *
   * The answer names the trash entry, which is what an undo sends back to `/note/restore`. A note
   * that is not there is a `404`, never a quiet success.
   */
  app.delete<{ Querystring: { folder?: string; name?: string } }>("/note", async (req, reply) => {
    const { folder, name } = req.query;
    if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
    if (!FOLDERS.includes(folder as Folder))
      return reply.code(400).send({ error: "unknown folder" });
    if (!isNoteName(name)) return reply.code(400).send({ error: "invalid name" });

    try {
      return { trash: await deleteNote(vault, { folder, name }) };
    } catch (err: unknown) {
      const refusal = noteRefusal(err);
      if (refusal) return reply.code(refusal.status).send({ error: refusal.message });
      throw err;
    }
  });

  /**
   * Undo a delete: put the trashed note back where it came from, and answer it as it now reads.
   *
   * Only the entry is named, never the destination - the trash folder remembers where the note
   * lived, so a restore cannot be pointed at another note. A name that has been taken again in the
   * meantime is a `409`, because replacing whatever holds it now would be a second, silent delete.
   */
  app.post<{ Body: { id?: string } }>("/note/restore", async (req, reply) => {
    const { id } = req.body ?? {};
    if (!id) return reply.code(400).send({ error: "id is required" });

    try {
      return { note: await restoreNote(vault, id) };
    } catch (err: unknown) {
      const refusal = noteRefusal(err);
      if (refusal) return reply.code(refusal.status).send({ error: refusal.message });
      throw err;
    }
  });

  /**
   * What is in the trash right now, newest delete first.
   *
   * Without this the only way to learn what a delete put there is a file manager, because the
   * undo on offer expires with the notice that carried it. Each entry answers the same `id` the
   * restore route takes, so the panel can offer both from one read.
   */
  app.get("/trash", async () => ({ trash: await listTrash(vault) }));

  /**
   * Remove every note in the trash.
   *
   * The one operation with no undo, so it answers a count rather than the entries it took: the
   * person confirming it has just read the list from `GET /trash`. Notes that were never deleted
   * are untouched.
   */
  app.delete("/trash", async () => emptyTrash(vault));

  return app;
}
