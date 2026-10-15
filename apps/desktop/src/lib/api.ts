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
