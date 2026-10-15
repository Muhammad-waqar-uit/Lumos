import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  buildVaultGraph,
  listNotes,
  searchNotes,
  readNote,
  getNotesByFolder,
} from "@lumos/vault-utils";
import { FOLDERS, type Folder } from "@lumos/shared";
import { LinkFetchError, fetchLinkCard } from "./fetch-link.js";
import { handleMessage } from "./handler.js";
import { startWhatsApp } from "./whatsapp.js";
import { VAULT } from "./vault.js";

const app = Fastify({ logger: true });

// Local-only dev origins (Vite dev server + Tauri). The server binds to 127.0.0.1.
await app.register(cors, {
  origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/, /^tauri:\/\//],
});

app.get("/health", async () => ({ ok: true }));

app.post<{ Body: { text?: string } }>("/message", async (req, reply) => {
  const text = req.body?.text;
  if (!text) return reply.code(400).send({ error: "text is required" });
  return { reply: await handleMessage(text) };
});

/** List every note in the vault, newest first. */
app.get("/notes", async () => ({ notes: await listNotes(VAULT) }));

/** Case-insensitive search across titles, content, and tags. */
app.get<{ Querystring: { q?: string } }>("/notes/search", async (req) => {
  return { notes: await searchNotes(VAULT, req.query.q ?? "") };
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
    return { link: await fetchLinkCard(url) };
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
app.get("/graph", async () => ({ graph: await buildVaultGraph(VAULT) }));

/** Note counts per vault folder. */
app.get("/folders", async () => {
  const groups = await Promise.all(
    FOLDERS.map(async (folder) => ({
      folder,
      count: (await getNotesByFolder(VAULT, folder)).length,
    })),
  );
  return { folders: groups };
});

/** Read a single note by folder + filename. */
app.get<{ Querystring: { folder?: string; name?: string } }>("/note", async (req, reply) => {
  const { folder, name } = req.query;
  if (!folder || !name) return reply.code(400).send({ error: "folder and name are required" });
  if (!FOLDERS.includes(folder as Folder)) return reply.code(400).send({ error: "unknown folder" });
  // Guard against path traversal: a plain filename that ends in .md, no separators.
  if (name.includes("/") || name.includes("\\") || name.includes("..") || !name.endsWith(".md")) {
    return reply.code(400).send({ error: "invalid name" });
  }
  try {
    return { note: await readNote(path.join(VAULT, folder, name), folder) };
  } catch {
    return reply.code(404).send({ error: "note not found" });
  }
});

await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 3001) });

if (process.env.LUMOS_DISABLE_WHATSAPP !== "1") {
  startWhatsApp().catch((err) => app.log.error(err));
} else {
  app.log.info("WhatsApp bridge disabled (LUMOS_DISABLE_WHATSAPP=1)");
}
