/**
 * The vault operations an MCP client can ask for.
 *
 * Every function takes the vault directory and plain data, and calls `@lumos/vault-utils` - the same
 * library the daemon and the desktop's routes use - so this server has no second way of reading or
 * writing a note. Nothing here speaks the MCP protocol and nothing here prints: the results are
 * values, which is what lets the tests drive them against a temporary vault.
 *
 * A refusal is a `NoteFileError` whose message is written for the person who asked, because the
 * client shows it back to them. A folder a tool is given must already exist: `saveNote` would
 * happily `mkdir` a path it was handed, and a vault the model can grow new top-level folders in is
 * a vault someone will find untidy a week later.
 */
import path from "node:path";
import {
  createFolder as createVaultFolder,
  deleteNote as trashNote,
  listFolderNames,
  listNotes as listVaultNotes,
  listTrash as listVaultTrash,
  moveNote as moveVaultNote,
  NoteFileError,
  readNote as readVaultNote,
  renameNote as renameVaultNote,
  restoreNote as restoreVaultNote,
  saveNote,
  searchNotes as searchVault,
  updateNote as updateVaultNote,
  updateNoteMeta,
  type TrashedNote,
} from "@lumos/vault-utils";
import type { Note, VaultEntry } from "@lumos/shared";
import { keyOf, resolveNote } from "./vault.js";

/** A note as a listing reports it: enough to choose one, not enough to read it. */
export interface NoteSummary {
  key: string;
  title: string;
  folder: string;
  tags: string[];
  created: string;
  excerpt: string;
}

function summary(entry: VaultEntry): NoteSummary {
  return {
    key: keyOf(entry.folder, entry.file),
    title: entry.title,
    folder: entry.folder,
    tags: entry.tags,
    created: entry.created,
    excerpt: entry.excerpt,
  };
}

/** A folder, and how many notes it holds. */
export interface FolderSummary {
  name: string;
  notes: number;
}

/** The folders the vault has, in the order the app shows them. */
export async function listFolders(vault: string): Promise<FolderSummary[]> {
  const [names, entries] = await Promise.all([listFolderNames(vault), listVaultNotes(vault)]);
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.folder, (counts.get(entry.folder) ?? 0) + 1);
  return names.map((name) => ({ name, notes: counts.get(name) ?? 0 }));
}

/** Every note, newest first, or the notes of one folder when a folder is named. */
export async function listNotes(vault: string, folder?: string): Promise<NoteSummary[]> {
  const entries = await listVaultNotes(vault);
  if (folder === undefined) return entries.map(summary);

  const folders = await listFolderNames(vault);
  if (!folders.includes(folder)) {
    throw new NoteFileError(
      "missing",
      `there is no folder called "${folder}" - the vault has ${folders.join(", ")}`,
    );
  }
  return entries.filter((entry) => entry.folder === folder).map(summary);
}

/** Notes whose title, tags or body contain the query. */
export async function searchNotes(vault: string, query: string): Promise<NoteSummary[]> {
  if (!query.trim()) throw new NoteFileError("invalid", "a search needs something to look for");
  return (await searchVault(vault, query)).map(summary);
}

/** Read one note: its frontmatter as the vault reports it, and its body. */
export async function readNote(vault: string, key: string): Promise<{ key: string; note: Note }> {
  const { folder, name, file } = resolveNote(vault, key);
  try {
    return { key: `${folder}/${name}`, note: await readVaultNote(file, folder) };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NoteFileError("missing", `there is no note at ${key}`);
    }
    throw err;
  }
}

/** What a note needs to be created: where it goes, and what it says. */
export interface CreateNoteInput {
  folder: string;
  text: string;
  /** Replaces the tags the text's hashtags produced. */
  tags?: string[];
  status?: string;
}

/**
 * Write a new note, exactly as a captured message would be written.
 *
 * `source` says `mcp`, so the note's own frontmatter tells the truth about where it came from: a
 * note that claims to have arrived over WhatsApp when it did not is worse than one that says
 * nothing. Tags and status are a second, small write - `saveNote` derives tags from the text, and
 * only the frontmatter patch can set a status.
 */
export async function createNote(
  vault: string,
  input: CreateNoteInput,
): Promise<{ key: string; note: Note }> {
  if (!input.text.trim()) throw new NoteFileError("invalid", "a note needs some text");

  const folders = await listFolderNames(vault);
  if (!folders.includes(input.folder)) {
    throw new NoteFileError(
      "missing",
      `there is no folder called "${input.folder}" - the vault has ${folders.join(", ")}. ` +
        "create_folder makes one.",
    );
  }

  const { file } = await saveNote(
    vault,
    { folder: input.folder, text: input.text },
    { source: "mcp" },
  );
  const key = keyOf(input.folder, file);

  if (input.tags !== undefined || input.status !== undefined) {
    await updateNoteMeta(
      vault,
      { folder: input.folder, name: path.basename(file) },
      {
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    );
  }

  return readNote(vault, key);
}

/** What a note update can change: the body, the tags, the status, any of them. */
export interface UpdateNoteInput {
  key: string;
  /** The whole new body. The frontmatter block is left exactly as the file has it. */
  content?: string;
  /** The whole new tag list. */
  tags?: string[];
  status?: string;
}

/** Change a note's body, tags or status. */
export async function updateNote(
  vault: string,
  input: UpdateNoteInput,
): Promise<{ key: string; note: Note }> {
  if (input.content === undefined && input.tags === undefined && input.status === undefined) {
    throw new NoteFileError("invalid", "nothing to change - send content, tags or status");
  }

  const { folder, name } = resolveNote(vault, input.key);
  if (input.content !== undefined) {
    await updateVaultNote(vault, { folder, name, content: input.content });
  }
  if (input.tags !== undefined || input.status !== undefined) {
    await updateNoteMeta(
      vault,
      { folder, name },
      {
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    );
  }

  return readNote(vault, input.key);
}

/** Rename a note to a new title, carrying the links that point at it. */
export async function renameNote(
  vault: string,
  input: { key: string; title: string },
): Promise<{ key: string; title: string; updated: string[] }> {
  const { folder, name } = resolveNote(vault, input.key);
  const renamed = await renameVaultNote(vault, { folder, name, title: input.title });
  return {
    key: keyOf(renamed.note.folder, renamed.note.file),
    title: renamed.note.title,
    // Only the notes a rename actually edited, so the answer says what happened rather than guesses.
    updated: renamed.updated,
  };
}

/** Move a note into another folder, keeping its name and its bytes. */
export async function moveNote(
  vault: string,
  input: { key: string; folder: string },
): Promise<{ key: string; folder: string }> {
  const { folder: from, name } = resolveNote(vault, input.key);

  const folders = await listFolderNames(vault);
  if (!folders.includes(input.folder)) {
    throw new NoteFileError(
      "missing",
      `there is no folder called "${input.folder}" - the vault has ${folders.join(", ")}. ` +
        "create_folder makes one.",
    );
  }

  const moved = await moveVaultNote(vault, {
    from: { folder: from, name },
    to: { folder: input.folder, name },
  });
  return { key: keyOf(moved.folder, moved.file), folder: moved.folder };
}

/** Move a note to the trash. The entry it answers with is what restores it. */
export async function deleteNote(vault: string, key: string): Promise<TrashedNote> {
  const { folder, name } = resolveNote(vault, key);
  return trashNote(vault, { folder, name });
}

/** Put a deleted note back where it came from. */
export async function restoreNote(
  vault: string,
  id: string,
): Promise<{ key: string; title: string }> {
  const note = await restoreVaultNote(vault, id);
  return { key: keyOf(note.folder, note.file), title: note.title };
}

/** The notes waiting in the trash, newest delete first. */
export async function listTrash(vault: string): Promise<TrashedNote[]> {
  return listVaultTrash(vault);
}

/** Create a folder. The name is checked by the vault, which is the only place that should decide. */
export async function createFolder(vault: string, name: string): Promise<{ folder: string }> {
  return { folder: await createVaultFolder(vault, name) };
}
