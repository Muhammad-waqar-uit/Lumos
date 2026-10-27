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
  createFolder,
  createNoteSearch,
  deleteNote,
  emptyTrash,
  getNotesByFolder,
  listFolderNames,
  listNotes,
  listTrash,
  moveNote,
  readNote,
  removeFolder,
  renameFolder,
  renameNote,
  restoreNote,
  saveNote,
  updateNote,
  updateNoteMeta,
} from "@lumos/vault-utils";
import { vaultInsights } from "@lumos/vault-utils/insights";
import type { LinkCard, WhatsAppStatus } from "@lumos/shared";
import { DISABLED_BRIDGE, DISABLED_SENTENCE, type BridgeControl } from "./bridge.js";
import { LinkFetchError, fetchLinkCard } from "./fetch-link.js";
import { handleMessage } from "./handler.js";
import type { PlanOptions } from "./plan.js";
import { pendingQr, qrToText } from "./qr.js";

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
  /** The pairing code `GET /qrcode` shows. The socket sets it; tests inject one. */
  qr?: () => string | null;
  /**
   * The WhatsApp link, as the routes report and drive it. Absent means capture is switched off, so
   * the app is told that rather than shown a Connect button that would do nothing.
   */
  bridge?: BridgeControl;
}

/** Escape the few characters that matter inside the pairing page's HTML. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The pairing page: a QR when WhatsApp is waiting for one, and a sentence either way.
 *
 * It is a plain page rather than part of the desktop because pairing is the daemon's own business -
 * the code lives in the daemon's memory, and the app is only one place a person might be looking. It
 * refreshes itself, because a code that has expired is worse than no code: it scans and does nothing.
 */
function qrPage(body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="10">
<title>Lumos - pair WhatsApp</title>
<style>
  body { background: #12100e; color: #f5efe6; font-family: ui-sans-serif, system-ui, sans-serif;
    display: flex; min-height: 100vh; margin: 0; align-items: center; justify-content: center; }
  main { max-width: 44rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.05rem; font-weight: 600; margin: 0 0 0.5rem; }
  p { color: #b9b0a4; font-size: 0.85rem; line-height: 1.5; margin: 0.5rem 0 1rem; }
  /* Light-on-dark, because that is the polarity qrToText draws in. Each character cell covers one
     module across and two down, so the line height is exactly two character widths (2ch): a module
     that is not square is a module a camera may not read. */
  pre { background: #000; color: #fff; border-radius: 0.5rem; display: inline-block;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px;
    letter-spacing: 0; line-height: 2ch; margin: 0; padding: 1rem; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export async function createApp({
  vault,
  logger = false,
  fetchLink = fetchLinkCard,
  plan,
  qr = pendingQr,
  bridge = DISABLED_BRIDGE,
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

  /**
   * The folders a request may name. Read from the vault per request rather than fixed at startup, so
   * a folder made a moment ago is accepted at once, and a folder deleted outside the app is not.
   */
  const folders = (): Promise<string[]> => listFolderNames(vault);

  /** Guard a folder that arrived in a request against the ones that actually exist. */
  async function knownFolder(folder: string): Promise<boolean> {
    return (await folders()).includes(folder);
  }

  app.get("/health", async () => ({ ok: true }));

  /**
   * The WhatsApp pairing code, as a page. The code is a session secret, so it is answered to the
   * loopback caller that asked and never logged; a phone that is already linked has none to show.
   */
  app.get("/qrcode", async (_req, reply) => {
    reply.type("text/html; charset=utf-8").header("cache-control", "no-store");
    const code = qr();
    if (!code) {
      return qrPage(
        "<h1>Nothing to pair right now</h1><p>WhatsApp is either already linked, or capture is switched off (LUMOS_DISABLE_WHATSAPP=1). Start the daemon with WhatsApp enabled to get a code.</p>",
      );
    }
    return qrPage(
      `<h1>Pair WhatsApp</h1><p>WhatsApp &gt; Linked devices &gt; Link a device, then scan this. It refreshes itself.</p><pre>${escapeHtml(
        qrToText(code),
      )}</pre>`,
    );
  });

  /**
   * The WhatsApp link, as one answer: its state, when that state began, why it is down - and the
   * pairing code while a phone still needs to scan one.
   *
   * The code is a session secret, so it is handed to the loopback caller that asked and never
   * logged, and it is absent in every state but `waiting`: an expired code is worse than none,
   * because it scans and does nothing.
   */
  const whatsappNow = (): WhatsAppStatus => {
    const report = bridge.status();
    const code = report.state === "waiting" ? qr() : null;
    return { ...report, qr: code ? qrToText(code) : null };
  };

  app.get("/whatsapp", async () => ({ whatsapp: whatsappNow() }));

  /**
   * Start the link, or say why it cannot be started.
   *
   * Capture is either on for this daemon or it is not - a request cannot overrule the setting the
   * process was started with - so asking for a disabled bridge is a `409` with the setting named.
   * A link that fails to come up answers the state it reached, which carries the reason.
   */
  app.post("/whatsapp/connect", async (req, reply) => {
    if (!bridge.status().enabled) return reply.code(409).send({ error: DISABLED_SENTENCE });
    try {
      await bridge.connect();
    } catch (err: unknown) {
      req.log.error(
        { name: err instanceof Error ? err.name : "unknown" },
        "whatsapp connect failed",
      );
      return reply.code(502).send({ error: "WhatsApp could not be started." });
    }
    return { whatsapp: whatsappNow() };
  });

  /**
   * Stop answering messages, keeping the phone linked.
   *
   * This is not an unlink: the pairing lives on the phone and in `auth_info`, and a person who
   * wants the device gone does that from WhatsApp itself. What this stops is the daemon writing
   * notes, which is what someone would reach for when the link is misbehaving.
   */
  app.post("/whatsapp/disconnect", async () => {
    await bridge.disconnect();
    return { whatsapp: whatsappNow() };
  });

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

  /**
   * The vault counted: the same figures the desktop's Stats pane and the MCP `vault_health` tool
   * answer with, from one implementation in `@lumos/vault-utils/insights`.
   *
   * It reads the listing and the graph, which is what the count is over - nothing here is walked
   * twice, and no path comes from the request, so there is nothing to guard.
   */
  app.get("/stats", async () => {
    const [entries, graph] = await Promise.all([listNotes(vault), buildVaultGraph(vault)]);
    return { stats: vaultInsights(entries, graph) };
  });

  /** Note counts per vault folder, including the folders that are still empty. */
  app.get("/folders", async () => {
    const groups = await Promise.all(
      (await folders()).map(async (folder) => ({
        folder,
        count: (await getNotesByFolder(vault, folder)).length,
      })),
    );
    return { folders: groups };
  });

  /**
   * Make a folder. The name is untrusted like any other path, so the vault checks it before it
   * becomes a directory - a separator in it would put the folder outside the vault. A name already
   * in use is a `409`: the caller asked for something to happen, and nothing would.
   */
  app.post<{ Body: { name?: string } }>("/folders", async (req, reply) => {
    const { name } = req.body ?? {};
    if (typeof name !== "string") return reply.code(400).send({ error: "name is required" });

    try {
      return { folder: await createFolder(vault, name) };
    } catch (err: unknown) {
      if (err instanceof NoteFileError)
        return reply.code(err.reason === "exists" ? 409 : 400).send({ error: err.message });
      throw err;
    }
  });

  /**
   * Rename a folder, and carry the links that named it.
   *
   * A folder is a directory, so this is one rename on disk: every note inside keeps its filename
   * and its date. The links that wrote the old path are rewritten in the notes that carried them,
   * and the files touched come back as `updated`, so a backlink cannot be left pointing at a
   * folder that is no longer there.
   *
   * A name already in use is a `409` and nothing is merged into it; a folder that is not there is
   * a `404`. The route never invents a folder to rename.
   */
  app.patch<{ Body: { folder?: string; to?: string } }>("/folder", async (req, reply) => {
    const { folder, to } = req.body ?? {};
    if (!folder || !to?.trim())
      return reply.code(400).send({ error: "folder and to are required" });
    // No `knownFolder` guard here: the vault checks the name itself and answers with a sentence
    // a person can act on ("There is no folder called Gone."), which "unknown folder" is not.
    // The same check that keeps a separator out of `createFolder` keeps one out here.
    try {
      return await renameFolder(vault, { from: folder, to });
    } catch (err: unknown) {
      const refusal = noteRefusal(err);
      if (refusal) return reply.code(refusal.status).send({ error: refusal.message });
      throw err;
    }
  });

  /**
   * Remove a folder: its notes move to Inbox, and the directory goes.
   *
   * Moving rather than deleting is the whole point of the route - a folder is a place to file
   * things, so removing one must never take a note with it. `leftover` is true when the directory
   * still holds files that are not notes, which are left exactly where they are. A folder that is
   * not there is a `404`, and Inbox itself is refused: it is where the notes would go.
   */
  app.delete<{ Querystring: { folder?: string } }>("/folder", async (req, reply) => {
    const { folder } = req.query;
    if (!folder) return reply.code(400).send({ error: "folder is required" });

    try {
      return await removeFolder(vault, folder);
    } catch (err: unknown) {
      const refusal = noteRefusal(err);
      if (refusal) return reply.code(refusal.status).send({ error: refusal.message });
      throw err;
    }
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
    if (!(await knownFolder(folder))) return reply.code(400).send({ error: "unknown folder" });

    const { file } = await saveNote(
      vault,
      { folder, text: text.trim() },
      {
        source: "desktop",
      },
    );
    return { note: await readNote(file, folder) };
  });

  /** Read a single note by folder + filename. */
  app.get<{ Querystring: { folder?: string; name?: string } }>("/note", async (req, reply) => {
    const { folder, name } = req.query;
    if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
    if (!(await knownFolder(folder))) return reply.code(400).send({ error: "unknown folder" });
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
      if (!(await knownFolder(folder))) return reply.code(400).send({ error: "unknown folder" });
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
      if (!(await knownFolder(folder))) return reply.code(400).send({ error: "unknown folder" });
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
      if (!(await knownFolder(folder))) return reply.code(400).send({ error: "unknown folder" });
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
      if (!(await knownFolder(folder)) || !(await knownFolder(toFolder)))
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
    if (!(await knownFolder(folder))) return reply.code(400).send({ error: "unknown folder" });
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
