import type { Folder, GraphData, Note, VaultEntry } from "@lumos/shared";

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

/** Read a single note by folder + filename. */
export async function getNote(folder: string, name: string): Promise<Note> {
  const { note } = await getJson<{ note: Note }>(
    `/note?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`,
  );
  return note;
}
