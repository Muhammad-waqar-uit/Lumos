/**
 * The daemon's HTTP surface, built as a factory rather than at import time.
 *
 * Two reasons it is a factory. The routes can be exercised without binding a port, so
 * `app.inject()` reaches them in the test suite. And everything they touch arrives as an
 * argument - the vault directory and the link fetcher - so no request can reach the real
 * vault or the network by accident.
 */
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  buildVaultGraph,
  getNotesByFolder,
  listNotes,
  readNote,
  searchNotes,
} from "@lumos/vault-utils";
import { FOLDERS, type Folder, type LinkCard } from "@lumos/shared";
import { LinkFetchError, fetchLinkCard } from "./fetch-link.js";
import { handleMessage } from "./handler.js";

export interface AppOptions {
  /** Vault root that every route reads, and `/message` writes into. */
  vault: string;
  /** Request logging. Off in tests, so a passing run stays quiet. */
  logger?: boolean;
  /** Injected by tests so the suite never reaches the network. */
  fetchLink?: (url: string) => Promise<LinkCard>;
}

export async function createApp({
  vault,
  logger = false,
  fetchLink = fetchLinkCard,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  // Local-only dev origins (Vite dev server + Tauri). The server binds to 127.0.0.1.
  await app.register(cors, {
    origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /^tauri:\/\//],
  });

  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: { text?: string } }>("/message", async (req, reply) => {
    const text = req.body?.text;
    if (!text) return reply.code(400).send({ error: "text is required" });
    return { reply: await handleMessage(text, vault) };
  });

  /** List every note in the vault, newest first. */
  app.get("/notes", async () => ({ notes: await listNotes(vault) }));

  /** Case-insensitive search across titles, content, and tags. */
  app.get<{ Querystring: { q?: string } }>("/notes/search", async (req) => {
    return { notes: await searchNotes(vault, req.query.q ?? "") };
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

  /** Read a single note by folder + filename. */
  app.get<{ Querystring: { folder?: string; name?: string } }>("/note", async (req, reply) => {
    const { folder, name } = req.query;
    if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
    if (!FOLDERS.includes(folder as Folder))
      return reply.code(400).send({ error: "unknown folder" });
    // Guard against path traversal: a plain filename that ends in .md, no separators.
    if (name.includes("/") || name.includes("\\") || name.includes("..") || !name.endsWith(".md")) {
      return reply.code(400).send({ error: "invalid name" });
    }
    try {
      return { note: await readNote(path.join(vault, folder, name), folder) };
    } catch {
      return reply.code(404).send({ error: "note not found" });
    }
  });

  return app;
}
