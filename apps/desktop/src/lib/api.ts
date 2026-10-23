import type { Folder, GraphData, LinkCard, Note, VaultEntry } from "@lumos/shared";

/** Where the desktop is getting its data from. */
export type Connection = "connecting" | "daemon" | "demo";

export interface FolderCount {
  folder: Folder;
  count: number;
}

/** Base URL of the local Lumos daemon. Override with VITE_DAEMON_URL. */
const BASE: string = import.meta.env.VITE_DAEMON_URL ?? "http://127.0.0.1:3001";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/** Note counts per vault folder. */
export async function getFolders(): Promise<FolderCount[]> {
  const { folders } = await getJson<{ folders: FolderCount[] }>("/folders");
  return folders;
}

/** Every note in the vault, newest first. */
export async function getNotes(): Promise<VaultEntry[]> {
  const { notes } = await getJson<{ notes: VaultEntry[] }>("/notes");
  return notes;
}

/** Case-insensitive search across titles, content, and tags. */
export async function searchNotes(query: string): Promise<VaultEntry[]> {
  const { notes } = await getJson<{ notes: VaultEntry[] }>(
    `/notes/search?q=${encodeURIComponent(query)}`,
  );
  return notes;
}

/** The vault's link graph: notes, internal links, tags, and links with no target yet. */
export async function getGraph(): Promise<GraphData> {
  const { graph } = await getJson<{ graph: GraphData }>("/graph");
  return graph;
}

/**
 * One link, scraped by the daemon: media the app can play, plus the page's readable
 * text. A refusal (a private host, a bad scheme) arrives as an Error with its message.
 */
export async function getLink(url: string): Promise<LinkCard> {
  const res = await fetch(`${BASE}/link?url=${encodeURIComponent(url)}`, {
    headers: { accept: "application/json" },
  });
  const body = (await res.json().catch(() => null)) as
    { link: LinkCard } | { error: string } | null;
  if (!res.ok) throw new Error(body && "error" in body ? body.error : `GET /link -> ${res.status}`);
  if (!body || !("link" in body)) throw new Error("GET /link returned an unexpected body");
  return body.link;
}

/** Read a single note by folder + filename. */
export async function getNote(folder: string, name: string): Promise<Note> {
  const { note } = await getJson<{ note: Note }>(
    `/note?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`,
  );
  return note;
}

/**
 * A write that answers the note as it now reads.
 *
 * Every refusal is reported in the daemon's own words (a bad name, an unknown folder, a name
 * another note holds), so a panel can show the reason instead of a status code. Only a response
 * with no body at all falls back to the method and the status.
 */
async function send(method: string, path: string, payload: unknown): Promise<Note> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { note: Note } | { error: string } | null;
  if (!res.ok)
    throw new Error(body && "error" in body ? body.error : `${method} ${path} -> ${res.status}`);
  if (!body || !("note" in body)) throw new Error(`${method} ${path} returned an unexpected body`);
  return body.note;
}

/**
 * Create a note in a folder and answer it as the vault now reads it.
 *
 * The daemon stamps it `source: desktop`, so a note written here is never mistaken for a WhatsApp
 * capture.
 */
export function createNote(folder: string, text: string): Promise<Note> {
  return send("POST", "/notes", { folder, text });
}

/**
 * Save an edited body into an existing note and answer the note as it now reads.
 *
 * The daemon rewrites the body only and never the frontmatter, so a failure keeps the draft the
 * editor is holding.
 */
export function saveNote(folder: string, name: string, content: string): Promise<Note> {
  return send("PUT", "/note", { folder, name, content });
}

/** What a rename did: the note as it now reads, and whose links followed it. */
export interface RenameResult {
  note: Note;
  /** Vault ids (`Folder/name.md`) of the other notes whose links were rewritten. */
  updated: string[];
}

/**
 * Rename a note to a new title and answer it as the vault now reads it.
 *
 * The daemon renames the file after the title, rewrites the body's first heading, and edits the
 * notes that linked to the old title, so the rename does not break its own backlinks.
 */
export async function renameNote(
  folder: string,
  name: string,
  title: string,
): Promise<RenameResult> {
  const res = await fetch(`${BASE}/note`, {
    method: "PATCH",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ folder, name, title }),
  });
  const body = (await res.json().catch(() => null)) as
    { note: Note; updated: string[] } | { error: string } | null;
  if (!res.ok)
    throw new Error(body && "error" in body ? body.error : `PATCH /note -> ${res.status}`);
  if (!body || !("note" in body)) throw new Error("PATCH /note returned an unexpected body");
  return { note: body.note, updated: body.updated };
}

/** Move a note into another folder, keeping its filename, and answer it as it now reads. */
export function moveNote(folder: string, name: string, toFolder: string): Promise<Note> {
  return send("POST", "/note/move", { folder, name, toFolder });
}

/** What a delete left behind: the trash entry an undo names, and the note it holds. */
export interface TrashedNote {
  id: string;
  folder: string;
  name: string;
  deleted: string;
}

/**
 * Delete a note by moving it to the daemon's trash, and answer the entry an undo needs.
 *
 * A refusal arrives as an Error with the daemon's sentence.
 */
export async function deleteNote(folder: string, name: string): Promise<TrashedNote> {
  const query = `folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`;
  const res = await fetch(`${BASE}/note?${query}`, {
    method: "DELETE",
    headers: { accept: "application/json" },
  });
  const body = (await res.json().catch(() => null)) as
    { trash: TrashedNote } | { error: string } | null;
  if (!res.ok)
    throw new Error(body && "error" in body ? body.error : `DELETE /note -> ${res.status}`);
  if (!body || !("trash" in body)) throw new Error("DELETE /note returned an unexpected body");
  return body.trash;
}

/** Undo a delete: put the trashed note back and answer it as the vault now reads it. */
export function restoreNote(id: string): Promise<Note> {
  return send("POST", "/note/restore", { id });
}
